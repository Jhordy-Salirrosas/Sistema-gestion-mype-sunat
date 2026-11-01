/**
 * Emisión de un comprobante desde la PANTALLA (M1, corrección del docente).
 *
 * Este servicio es el que faltaba entre el formulario y el generador UBL.
 * Ordena las cuatro cosas que una emisión real necesita y que estaban
 * repartidas o ausentes:
 *
 *  1. **Nota de crédito/débito exige comprobante de origen.** El docente:
 *     "es sobre el documento que ya está, no empiezas haciendo una nota de
 *     crédito". No basta con que el campo venga: se comprueba que ese
 *     comprobante exista en la empresa y que su saldo permita la nota.
 *
 *  2. **Validación de cantidad contra el stock disponible.** El docente: "la
 *     cantidad tiene que ser validada dependiendo de lo que tienes". El
 *     `StockValidationService` ya existía y estaba probado, pero **nadie lo
 *     invocaba**: solo lo llamaba su propio test. Aquí se conecta.
 *
 *  3. **Correlativo reservado por la base**, no por el navegador (TA-60).
 *     Se reserva DESPUÉS de validar: un correlativo consumido por una factura
 *     rechazada deja un hueco en la serie.
 *
 *  4. **El emisor sale de la empresa autenticada**, nunca del formulario. Un
 *     RUC escribible permitiría emitir a nombre de otra empresa.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';
import type { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { InvoiceSeriesService, SerieNoDisponibleError } from './invoiceSeriesService';
import { StockValidationService, type ItemAValidar } from './stockValidationService';
import {
  traducirEmision,
  type ComprobanteTraducido,
  type DatosEmisor,
} from './emitirComprobanteAdapter';
import { validarAdquirente } from '../../domain/rules/taxpayerIdValidator';
import { InvoiceNoteService } from './invoiceNoteService';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';

/** Tipos que modifican otro comprobante. */
const TIPOS_NOTA = ['07', '08'] as const;

/** Respuesta de la emisión para la pantalla. */
export interface ResultadoEmision {
  success: boolean;
  /** Número completo del comprobante (F001-00000001). */
  numero: string;
  serie: string;
  correlativo: number;
  tipo_comprobante: string;
  monto_total: number;
  importes: ComprobanteTraducido['importes'];
  /** Avisos no bloqueantes, para mostrarlos junto al resultado. */
  avisos: readonly string[];
  /** Detalle por línea con su IGV, para el recibo en pantalla. */
  lineas: readonly {
    descripcion: string;
    cantidad: number;
    unidad: string;
    valor_unitario: number;
    igv: number;
    total: number;
  }[];
}

@Injectable()
export class EmitirComprobanteService {
  private readonly logger = new Logger(EmitirComprobanteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly series: InvoiceSeriesService,
    private readonly stock: StockValidationService,
    private readonly notas: InvoiceNoteService,
    /**
     * El repositorio es el ÚNICO camino que encola el envío a SUNAT dentro de la
     * misma transacción. Inyectarlo (y no escribir con `prisma.invoice.create`)
     * es lo que impide que un comprobante quede guardado sin llegar nunca a la
     * cola. Ver `persistir`.
     */
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly repositorio: IInvoiceRepositoryPort,
  ) {}

  /**
   * Valida, traduce y persiste el comprobante.
   *
   * Lanza excepciones con mensaje de NEGOCIO (400/403/404), no un 500: el
   * usuario tiene que entender qué corregir sin llamar al soporte.
   */
  async emitir(
    dto: EmitirComprobanteDto,
    companyId: string,
  ): Promise<ResultadoEmision> {
    if (!companyId) {
      throw new ForbiddenException(
        'La petición no tiene empresa asociada: falta companyId en el token',
      );
    }

    const emisor = await this.datosDelEmisor(companyId);

    // 1. El documento del adquirente, antes de tocar nada.
    validarAdquirente(
      dto.customer_identity_number
        ? {
            tipoDoc: dto.customer_identity_type ?? '',
            numeroDoc: dto.customer_identity_number,
            razonSocial: dto.customer_legal_name,
          }
        : null,
      { tipoComprobante: dto.tipo_comprobante, importeTotal: this.totalDeclarado(dto) },
    );

    // 2. La nota necesita un comprobante que exista de verdad.
    await this.verificarDocumentoOrigen(dto, companyId);

    // 3. El stock, antes de reservar correlativo.
    await this.validarStock(dto, companyId);

    // 4. La detracción necesita la cuenta del Banco de la Nación del emisor:
    // SUNAT rechaza con 3034 si el XML no la trae. Se comprueba ANTES de
    // reservar el número, porque un correlativo consumido por un comprobante
    // que SUNAT rechaza queda quemado para siempre.
    this.validarCuentaDetraccion(dto);

    // 5. Recién ahora se consume un número de la serie.
    //
    // `reservarCorrelativo` lanza `SerieNoDisponibleError`, una excepción de
    // DOMINIO y no de Nest. Sin traducirla, Nest la devuelve como 500 "Internal
    // Server Error", que hace creer que el servidor falló cuando en realidad
    // falta configurar la serie. Se convierte en 404 (no existe) o 409 (inactiva).
    const correlativo = await this.reservarNumero(dto, companyId);

    const traducido = traducirEmision(dto, emisor, correlativo);

    await this.persistir(traducido.dto, companyId, traducido.importes);
    const numero = `${traducido.dto.serie}-${String(correlativo).padStart(8, '0')}`;
    this.logger.log(
      `[M1] Emitido ${numero} por S/ ${traducido.importes.total.toFixed(2)} ` +
        `(${dto.items.length} línea(s))`,
    );

    return {
      success: true,
      numero,
      serie: traducido.dto.serie,
      correlativo,
      tipo_comprobante: dto.tipo_comprobante,
      monto_total: traducido.importes.total,
      importes: traducido.importes,
      avisos: traducido.avisos,
      lineas: traducido.lineas.map((linea) => ({
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        unidad: linea.unidad ?? 'NIU',
        valor_unitario: linea.valorUnitario,
        igv: linea.igvLinea,
        total: linea.totalLinea,
      })),
    };
  }

  /**
   * Total aproximado solo para la regla del umbral de la boleta.
   *
   * Se calcula sin IGV porque lo único que decide `validarAdquirente` es si la
   * boleta pasa de S/ 700; hacer la liquidación completa aquí duplicaría el
   * trabajo que hace el adaptador dos líneas después.
   */
  private totalDeclarado(dto: EmitirComprobanteDto): number {
    return dto.items.reduce(
      (suma, item) => suma + item.cantidad * item.valorUnitario,
      0,
    );
  }

  /** Datos fiscales del emisor desde la base, jamás desde el formulario. */
  private async datosDelEmisor(companyId: string): Promise<DatosEmisor> {
    const empresa = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        ruc: true,
        legal_name: true,
        trade_name: true,
      },
    });

    if (!empresa) {
      throw new NotFoundException(
        'La empresa del token no existe: no se puede emitir a su nombre',
      );
    }

    return {
      ruc: empresa.ruc,
      razonSocial: empresa.legal_name,
      nombreComercial: empresa.trade_name ?? undefined,
    };
  }

  /**
   * Una nota solo se emite sobre un comprobante ya registrado.
   *
   * Se comprueba la existencia y el saldo, no solo que el campo venga lleno:
   * aceptar cualquier texto dejaría crear notas huérfanas que SUNAT rechaza
   * con la regla 3272 ("el documento relacionado no existe").
   */
  private async verificarDocumentoOrigen(
    dto: EmitirComprobanteDto,
    companyId: string,
  ): Promise<void> {
    if (!TIPOS_NOTA.includes(dto.tipo_comprobante as '07' | '08')) return;

    const referencia = dto.documento_afectado?.trim();
    if (!referencia) {
      throw new BadRequestException(
        'Una nota de crédito o débito se emite sobre un comprobante existente: ' +
          'indique el documento afectado (por ejemplo F001-00000042).',
      );
    }

    if (!dto.codigo_motivo_nota?.trim()) {
      throw new BadRequestException(
        'Indique el motivo de la nota (Catálogo 09): sin código SUNAT la rechaza.',
      );
    }

    const origen = await this.buscarPorNumero(companyId, referencia);

    if (!origen) {
      throw new NotFoundException(
        `No existe el comprobante ${referencia} en esta empresa. ` +
          'En una nota de crédito no se empieza por la nota: primero tiene que ' +
          'existir el comprobante que se modifica.',
      );
    }

    if (origen.estado === 'ANULADO') {
      throw new BadRequestException(
        `El comprobante ${referencia} está anulado: la nota no tendría efecto.`,
      );
    }

    // Una nota de crédito devuelve dinero: no puede superar lo que queda por
    // devolver del comprobante original.
    if (dto.tipo_comprobante === '07') {
      const totalNota = this.totalDeclarado(dto);
      const saldo = await this.saldoDevolvible(
        companyId,
        origen.id,
        Number(origen.monto_total),
      );
      if (totalNota > saldo + 0.01) {
        throw new BadRequestException(
          `La nota de crédito (S/ ${totalNota.toFixed(2)}) supera el saldo ` +
            `disponible de ${referencia} (S/ ${saldo.toFixed(2)}).`,
        );
      }
    }
  }

  /**
   * Saldo devolvible del comprobante, ya descontadas sus notas previas.
   *
   * `referenced_invoice_id` es la columna real del modelo; se consulta por id y
   * no por número para que dos empresas con la misma serie no se crucen.
   */
  private async saldoDevolvible(
    companyId: string,
    origenId: string,
    total: number,
  ): Promise<number> {
    const notas = await this.prisma.invoice.findMany({
      where: {
        company_id: companyId,
        referenced_invoice_id: origenId,
        tipo_comprobante: '07',
      },
      select: { monto_total: true },
    });

    const devuelto = notas.reduce(
      (suma, nota) => suma + Number(nota.monto_total),
      0,
    );
    return Math.max(0, Number(total) - devuelto);
  }

  /** Busca un comprobante por serie-correlativo dentro de la empresa. */
  private async buscarPorNumero(companyId: string, numero: string) {
    const [serie, correlativo] = this.partirNumero(numero);
    if (serie === null) return null;

    return this.prisma.invoice.findFirst({
      where: { company_id: companyId, serie, correlativo },
      select: {
        id: true,
        monto_total: true,
        estado: true,
        tipo_comprobante: true,
      },
    });
  }

  /** 'F001-00000042' → ['F001', 42]. Devuelve null si no tiene forma válida. */
  private partirNumero(numero: string): [string | null, number] {
    const limpio = numero.trim().toUpperCase();
    const partes = limpio.split('-');
    if (partes.length !== 2) return [null, 0];

    const serie = partes[0];
    const correlativo = Number.parseInt(partes[1], 10);

    if (serie.length !== 4 || !Number.isFinite(correlativo) || correlativo <= 0) {
      return [null, 0];
    }

    return [serie, correlativo];
  }

  /**
   * Reserva el correlativo traduciendo el error de dominio a un código HTTP.
   *
   * Un 500 le dice al usuario "el sistema falló". Lo que pasa en realidad es que
   * la serie no está dada de alta o está inactiva, y eso se arregla en la
   * pantalla de configuración: 404 o 409 con el motivo.
   */
  private async reservarNumero(
    dto: EmitirComprobanteDto,
    companyId: string,
  ): Promise<number> {
    try {
      return await this.series.reservarCorrelativo(
        companyId,
        dto.tipo_comprobante,
        dto.serie.toUpperCase(),
      );
    } catch (error) {
      if (error instanceof SerieNoDisponibleError) {
        if (error.motivo === 'INACTIVA') {
          throw new ConflictException(error.message);
        }
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * La detracción exige la cuenta del Banco de la Nación.
   *
   * SUNAT responde 3034 si el XML no la trae, y ese rechazo consume correlativo.
   * Avisar antes es más barato que descubrirlo en la respuesta.
   */
  private validarCuentaDetraccion(dto: EmitirComprobanteDto): void {
    const llevaDetraccion = dto.items.some((item) =>
      Boolean(item.codigoDetraccion?.trim()),
    );

    if (llevaDetraccion && !dto.cuenta_banco_nacion?.trim()) {
      throw new BadRequestException(
        'La operación tiene detracción: indique la cuenta del Banco de la ' +
          'Nación del emisor. SUNAT rechaza el comprobante sin ella (código 3034).',
      );
    }
  }

  /**
   * Valida la cantidad contra el stock disponible.
   *
   * Solo se validan las líneas con código de producto: un servicio no tiene
   * almacén y bloquearlo impediría facturar consultoría. Los productos que no
   * están en el inventario tampoco bloquean (el usuario puede estar dando de
   * alta un comprobante histórico); se avisa en el log.
   */
  private async validarStock(
    dto: EmitirComprobanteDto,
    companyId: string,
  ): Promise<void> {
    const items: ItemAValidar[] = dto.items.map((item) => ({
      codigo: item.codigo ?? null,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      unidad: item.unidad,
    }));

    await this.stock.validar(companyId, items);
  }

  /**
   * Guarda el comprobante con su outbox transaccional.
   *
   * Se reutiliza `saveWithTransactionalOutbox` y NO un `prisma.invoice.create`
   * directo. La diferencia no es cosmética: el repositorio crea el comprobante
   * y encola el trabajo a SUNAT en la MISMA transacción. Con un `create` suelto
   * el documento quedaba guardado como PENDIENTE pero **nadie lo encolaba**, así
   * que el worker nunca lo procesaba: la factura existía en la bandeja y jamás
   * iba a SUNAT. Se detectó emitiendo de verdad y viendo que el estado no
   * cambiaba y no había movimiento de Kardex.
   *
   * Como las tablas de `Invoice` no son objeto de este servicio, se construye la
   * entidad de dominio —que es lo que el repositorio espera— en lugar de armar
   * los campos a mano.
   */
  private async persistir(
    dto: CreateInvoiceDto,
    companyId: string,
    importes?: ComprobanteTraducido['importes'],
  ): Promise<InvoicePersistenceResult> {
    const entidad = new InvoiceEntity({
      company_id: companyId,
      ruc_emisor: dto.ruc_emisor,
      serie: dto.serie,
      correlativo: dto.correlativo,
      tipo_comprobante: dto.tipo_comprobante,
      monto_total: dto.monto_total,
      fecha_emision: new Date(dto.fecha_emision),
      payload_ubl: dto.payload_ubl,
      // La bandeja y el PDF leen el cliente de las columnas propias de la
      // tabla, no del payload: si no se copian aquí la fila sale sin cliente.
      customer_identity_type: dto.customer_identity_type,
      customer_identity_number: dto.customer_identity_number,
      customer_legal_name: dto.customer_legal_name,
    });

    const resultado = await this.repositorio.saveWithTransactionalOutbox(entidad);

    // LOS IMPORTES DESGLOSADOS TAMBIÉN SON COLUMNAS DE LA TABLA.
    //
    // `taxable_operations`, `total_igv` y las demás existen desde el Sprint 1 y
    // quedaban en 0: solo se guardaba `monto_total`. Por eso la trama QR del
    // modal salía con `|0.00|` en el IGV y el detalle de la API devolvía
    // `total_igv: 0` en una factura de S/ 1,046.66 con S/ 159.66 de IGV.
    // La base de la trama QR es lo que SUNAT valida al leer el código.
    if (importes) {
      await this.prisma.invoice.update({
        where: { id: resultado.id },
        data: {
          taxable_operations: importes.gravado,
          exempt_operations: importes.exonerado,
          unaffected_operations: importes.inafecto,
          total_igv: importes.igv,
        },
      });
    }

    // LAS LÍNEAS TIENEN QUE QUEDAR EN `invoice_items`.
    //
    // El puente contable (InvoiceAccountingBridgeService) lee las líneas de esa
    // tabla, no del `payload_ubl`. Sin ellas el comprobante se acepta en SUNAT,
    // el asiento contable cuadra y el Kardex queda en 0: la mercadería vendida
    // nunca sale del almacén.
    //
    // Se escribe DESPUÉS de la transacción del comprobante a propósito: si algo
    // falla aquí, el comprobante ya existe fiscalmente y lo que falta es
    // reconstruible; al revés se perdería un documento ya emitido.
    await this.guardarLineas(resultado.id, dto);

    return resultado;
  }

  /** Copia las líneas del payload en `invoice_items` para el puente contable. */
  private async guardarLineas(
    invoiceId: string,
    dto: CreateInvoiceDto,
  ): Promise<void> {
    const payload = dto.payload_ubl as unknown as {
      lineas?: Array<{
        id: number;
        codigo?: string;
        descripcion: string;
        unidad?: string;
        cantidad: number;
        valorUnitario: number;
        precioUnitario?: number;
        afectacion: string;
        igvLinea: number;
        totalLinea: number;
      }>;
    };

    const lineas = payload.lineas ?? [];
    if (lineas.length === 0) return;

    await this.prisma.invoiceItem.createMany({
      data: lineas.map((linea, indice) => ({
        invoice_id: invoiceId,
        item_order: linea.id ?? indice + 1,
        item_code: linea.codigo?.trim() || null,
        description: linea.descripcion,
        unit_code: (linea.unidad ?? 'NIU').toUpperCase(),
        quantity: linea.cantidad,
        unit_value: linea.valorUnitario,
        unit_price: linea.precioUnitario ?? linea.valorUnitario * 1.18,
        igv_affectation_type: linea.afectacion,
        igv_amount: linea.igvLinea,
        total_amount: linea.totalLinea,
      })),
    });
  }
}
