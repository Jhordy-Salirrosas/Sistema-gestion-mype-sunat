import {
  IssuerConfigResolver,
  type IssuerContext,
} from '../sunat/issuerConfigResolver';
/**
 * TA-28 - Consumidor de la cola de facturas y recarga del job.
 *
 * El defecto que corrige este archivo: `queue.enqueueInvoiceInTx` publicaba en
 * `sunat-invoice-queue` pero nadie escuchaba esa cola. El comprobante entraba a
 * pg-boss y se quedaba ahi para siempre: no llegaba a SUNAT ni obtenia CDR.
 *
 * Responsabilidades:
 *  1. Registrar `boss.work` sobre la cola de facturas (criterio 1).
 *  2. Traducir el payload minimo del job (`{ invoice_id }`) a los datos
 *     completos que necesita el envio: XML del payload_ubl, firma XMLDSig,
 *     ZIP y credenciales SOL.
 *  3. Aplicar la compuerta XSL oficial de TA-31 ANTES de tocar la red (TA-58).
 *  4. Delegar el envio en `InvoiceRetryService.processWithRetry`, que es quien
 *     aplica el backoff de 5/15/45 s (HU-04) y el Circuit Breaker (TA-33).
 *
 * Lo que este archivo NO hace, a proposito: backoff, conteo de intentos y
 * movimiento a la DLQ. Eso ya vive en `InvoiceRetryService` y duplicarlo haria
 * que cada job se reintente dos veces. Lo dice el propio spec del modulo:
 *
 *   "`InvoiceRetryService` es el unico punto que mueve jobs a la DLQ y marca la
 *    Invoice en `ERROR_RED`; el worker de facturacion no debe reimplementar esa
 *   secuencia."  (specs/m2_resilience.spec.md, TA-57)
 */
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../database/prismaService';
import { InvoiceStatus } from '../../generated/client/enums';
import { RegisterInvoiceAccountingEntryUseCase } from '../accounting/application/use-cases/registerInvoiceAccountingEntryUseCase';
import {
  InvoiceRetryService,
  RetryInvoiceResult,
} from '../resilience/infrastructure/queue/invoiceRetryService';
import { QueueService } from '../resilience/infrastructure/queue/queue.service';
import { CdrPersistenceService } from '../sunat/cdr-persistence.service';
import { SignatureService } from '../sunat/signature.service';
import { buildZipFileName } from '../sunat/soap/soap.constants';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../sunat/soap/sunatBillTypes';
import {
  AVISO_DEMO,
  ErrorValidacionBloqueada,
  decidirEnvio,
} from './application/services/invoiceSendGate';
import { SunatXslValidatorService } from './application/services/sunatXslValidatorService';
import type { InvoicePayload } from './invoicePayload';
import { aplicarDescuentoGlobal } from './application/services/descuentoGlobal';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { InvoiceAccountingBridgeService } from './application/services/invoiceAccountingBridgeService';
import type { FacturaParaPuente } from './application/services/invoiceAccountingBridgeService';
import { SignedXmlStorageService } from './application/services/signedXmlStorageService';

/** Payload que viaja en la cola: solo identifica el comprobante. */
export interface InvoiceJobPayload {
  invoice_id: string;
}

/** Fila minima de Invoice que necesita el consumidor. */
interface InvoiceRow {
  company_id: string;
  id: string;
  ruc_emisor: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  estado: InvoiceStatus;
  payload_ubl: unknown;
  xml_storage_url: string | null;
}

/** Comprobante ya firmado y empaquetado, listo para `sendBill`. */
export interface JobAprobado {
  params: SendInvoiceParams;
  firmado: boolean;
  /**
   * TA-58: lo que decidio la compuerta XSL antes de tocar la red.
   *  - `null`: el XML paso la validacion y se puede enviar.
   *  - `ProcessCdrResult`: el XML esta mal emitido; el comprobante queda en el
   *    estado de ese resultado y NO se llama a SUNAT.
   */
  bloqueoXsl: ProcessCdrResult | null;
  /**
   * true si la compuerta se omitio por `BYPASS_XSL_GATE_DEMO=true`.
   *
   * Se propaga hasta aqui, y no solo hasta el log, para que quien inspeccione
   * el resultado de `preparar()` pueda saber si ese comprobante se envio sin
   * validar. En una exposicion eso es justo lo que hay que poder demostrar.
   */
  omitidaPorDemo: boolean;
}

@Injectable()
export class InvoiceJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(InvoiceJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly retry: InvoiceRetryService,
    private readonly prisma: PrismaService,
    private readonly ublGenerator: UblGeneratorService,
    private readonly xsdValidator: XsdValidatorService,
    private readonly signature: SignatureService,
    // TA-58: las dos piezas que faltaban para cerrar la compuerta XSL.
    // `SunatXslValidatorService` ejecuta la hoja oficial de TA-31 y
    // `CdrPersistenceService` deja el rechazo en el historial, igual que un
    // rechazo de SUNAT.
    private readonly xslValidator: SunatXslValidatorService,
    private readonly cdrPersistence: CdrPersistenceService,
    // TA-68: puente facturacion -> Kardex + Contabilidad, solo tras ACEPTADO
    // u OBSERVADO. Es el dueño del asiento de venta.
    private readonly puenteContable: InvoiceAccountingBridgeService,
    /**
     * Guarda el XML firmado que se envía.
     *
     * Sin esto la descarga regeneraba el documento desde el payload y entregaba
     * un XML sin `<ds:Signature>`: el archivo se llamaba como el comprobante
     * pero no era el que viajó a SUNAT.
     */
    private readonly xmlFirmado: SignedXmlStorageService,
    /**
     * Asiento de venta de contabilidad (P0 de Oliver).
     *
     * Convive con el puente porque son idempotentes por REFERENCIAS DISTINTAS:
     * el puente busca por el número del comprobante (`F001-00000053`) y este
     * caso de uso por el UUID. Si se llamaran los dos sin más, la misma venta
     * quedaría asentada dos veces. Por eso solo actúa cuando el puente no dejó
     * asiento —ver `registrarEnContabilidad`—, y queda como respaldo.
     */
    @Optional()
    private readonly accounting?: RegisterInvoiceAccountingEntryUseCase,
    @Optional() private readonly issuerConfig?: IssuerConfigResolver,
  ) {}

  async onModuleInit(): Promise<void> {
    // Un doble de QueueService en las pruebas e2e puede no exponer el metodo:
    // en ese caso no hay cola que consumir y el arranque no debe fallar.
    if (typeof this.queue.registerInvoiceWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerInvoiceWorker: el consumidor de comprobantes no se registra',
      );
      return;
    }

    await this.queue.registerInvoiceWorker((job) => this.procesar(job));
    this.logger.log('Consumidor de comprobantes registrado');
  }

  /**
   * Un job de la cola. Nunca lanza hacia pg-boss: un throw haria que el
   * transporte marque el job como fallido y lo reintente por su cuenta,
   * saltandose el backoff de `InvoiceRetryService`.
   *
   * UNICA excepcion (TA-58): `ErrorValidacionBloqueada`, que se relanza a
   * proposito. Explicado en `bloqueoDeInfraestructura`.
   */
  async procesar(job: InvoiceJobPayload): Promise<RetryInvoiceResult | null> {
    const invoiceId = job?.invoice_id;
    if (!invoiceId) {
      this.logger.error('Job sin invoice_id: se descarta');
      return null;
    }

    let aprobado: JobAprobado;
    try {
      aprobado = await this.preparar(invoiceId);
    } catch (error) {
      if (error instanceof ErrorValidacionBloqueada) {
        return this.bloqueoDeInfraestructura(invoiceId, error);
      }

      // Fallo al generar, validar o firmar: no tiene sentido reintentar contra
      // SUNAT porque el XML saldria igual de invalido. Se deja en ERROR_RED.
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`[TA-28] ${invoiceId} no se pudo preparar: ${mensaje}`);
      await this.marcar(invoiceId, InvoiceStatus.ERROR_RED);
      return null;
    }

    // TA-58, criterio 1: si la compuerta XSL marco defectos en el comprobante,
    // el objeto ya quedo ENVIADO/RECHAZADO en la base de datos y NO se abre
    // socket SOAP. Antes de este corte, `processWithRetry` se llamaba igual y
    // el XML invalido gastaba los 3 intentos del backoff hasta la DLQ.
    if (aprobado.bloqueoXsl) {
      this.logger.error(
        `[TA-58] ${invoiceId} bloqueado antes de enviar por la validacion XSL: ${aprobado.bloqueoXsl.error ?? 'sin detalle'}`,
      );
      return null;
    }

    const resultado = await this.retry.processWithRetry(aprobado.params);

    // TA-68: si SUNAT aceptó u observó el comprobante, cabe mover el stock y
    // asentar la venta. Con un rechazo o un error de red NO: el documento fiscal
    // todavía no es válido y contabilizarlo dejaría asientos de facturas que
    // nunca existieron.
    if (
      resultado &&
      (resultado.estado === InvoiceStatus.ACEPTADO ||
        resultado.estado === InvoiceStatus.OBSERVADO)
    ) {
      await this.registrarEnContabilidad(invoiceId, resultado.estado);
    }

    return resultado;
  }

  /**
   * Ejecuta el puente facturación → Kardex + Contabilidad (TA-68).
   *
   * Nunca propaga el error: la factura ya está aceptada por SUNAT y un fallo
   * contable no la invalida. Se registra en el log para poder reintentarlo.
   */
  private async registrarEnContabilidad(
    invoiceId: string,
    estado: InvoiceStatus,
  ): Promise<void> {
    let asientoDelPuente: string | undefined;
    let bloquearRespaldo = true;
    try {
      const factura = await this.cargarParaPuente(invoiceId, estado);

      if (factura) {
        bloquearRespaldo = Boolean(
          factura.motivoBloqueoAsiento ||
          (factura.importes.descuentoNoAfecto ?? 0) > 0,
        );
        const resultado = await this.puenteContable.registrar(factura);
        asientoDelPuente = resultado.asientoId;

        if (!resultado.completo) {
          this.logger.warn(
            `[TA-68] ${invoiceId}: puente incompleto (${resultado.errores.join(' | ')})`,
          );
        } else {
          this.logger.log(
            `[TA-68] ${invoiceId}: ${resultado.movimientosRegistrados} movimiento(s) de Kardex` +
              `${resultado.asientoOmitido ? ', asiento ya existente' : `, asiento ${resultado.asientoId ?? 'creado'}`}`,
          );
        }
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[TA-68] ${invoiceId}: no se pudo contabilizar: ${mensaje}`,
      );
    }

    // RESPALDO: si el puente no dejó asiento, contabilidad emite el suyo.
    // Va FUERA del try para que un fallo del puente no impida asentar la venta:
    // son dos escritores con referencias distintas y solo uno debe actuar.
    if (bloquearRespaldo) {
      if (!asientoDelPuente)
        this.logger.warn(
          `[CONTABILIDAD] ${invoiceId}: asiento automático omitido; requiere revisión contable o no se pudo leer el comprobante.`,
        );
      return;
    }
    try {
      await this.registrarAsiento(invoiceId, asientoDelPuente);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[CONTABILIDAD] ${invoiceId}: no se pudo asentar: ${mensaje}`,
      );
    }
  }

  /**
   * Arma la factura que consume el puente.
   *
   * Los importes NO se recalculan aquí: se toman del payload que produjo el XML
   * enviado a SUNAT, para que el asiento use exactamente las cifras que constan
   * en el comprobante y no una segunda liquidación que podría diferir.
   */
  private async cargarParaPuente(
    invoiceId: string,
    _estado: InvoiceStatus,
  ): Promise<FacturaParaPuente | null> {
    const fila = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        company_id: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        fecha_emision: true,
        payload_ubl: true,
        items: {
          orderBy: { item_order: 'asc' },
          select: {
            item_code: true,
            description: true,
            unit_code: true,
            quantity: true,
            unit_value: true,
            igv_affectation_type: true,
          },
        },
      },
    });

    if (!fila) return null;

    const payload = (fila.payload_ubl ?? {}) as unknown as InvoicePayload;
    const items = fila.items ?? [];
    const importes = this.liquidarParaPuente(items, payload);

    return {
      id: fila.id,
      companyId: fila.company_id,
      tipoComprobante: fila.tipo_comprobante,
      serie: fila.serie,
      correlativo: fila.correlativo,
      fechaEmision: fila.fecha_emision.toISOString().slice(0, 10),
      cliente: { razonSocial: payload.cliente?.razonSocial },
      items: items.map((item) => ({
        itemCode: item.item_code ?? undefined,
        descripcion: item.description,
        unidad: item.unit_code,
        cantidad: Number(item.quantity),
        valorUnitario: Number(item.unit_value),
        afectacion: item.igv_affectation_type,
      })),
      importes,
      motivoBloqueoAsiento: null,
    };
  }

  /**
   * Reparte las líneas persistidas entre las bases tributarias.
   *
   * Se calcula sobre los ITEMS GUARDADOS y no sobre el payload, por dos razones:
   * el payload guardado no siempre trae las líneas completas, y los importes que
   * valen para el asiento son los que quedaron registrados en el comprobante.
   *
   * Mapa del Catálogo 07 igual al del generador UBL (TA-62): 10xx → gravado,
   * 20/21 → exonerado, 30-37 → inafecto, 40 → exportación (también fuera del
   * IGV) y las gratuitas (11-16, 21, 31-36) no suman a ninguna base.
   */
  private liquidarParaPuente(
    items: readonly {
      quantity: unknown;
      unit_value: unknown;
      igv_affectation_type: string;
    }[],
    payload: InvoicePayload,
  ): FacturaParaPuente['importes'] {
    const gratuitas = new Set([
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '21',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
    ]);

    const centimos = (n: number): number => Math.round(n * 100) / 100;
    const lineasXml = payload.lineas ?? (payload.linea ? [payload.linea] : []);
    const descuentos = lineasXml
      .flatMap((linea) => linea.descuentos ?? [])
      .filter((descuento) => descuento.codigo === '01')
      .map((descuento) => descuento.monto);
    if (payload.descuentoGlobal?.codigo === '03')
      descuentos.push(payload.descuentoGlobal.monto);
    if (
      descuentos.some(
        (monto) =>
          typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0,
      )
    ) {
      throw new Error('Descuento 01/03 inválido: requiere revisión contable.');
    }
    const descuentoNoAfecto = centimos(
      descuentos.reduce((suma, monto) => suma + monto, 0),
    );
    if (
      payload.otrosDescuentos !== undefined &&
      (typeof payload.otrosDescuentos !== 'number' ||
        !Number.isFinite(payload.otrosDescuentos) ||
        centimos(payload.otrosDescuentos) !== descuentoNoAfecto)
    ) {
      throw new Error(
        'Los descuentos declarados no concuerdan con su detalle; requiere revisión contable.',
      );
    }
    const totalConDescuento = (bruto: number): number => {
      const total = centimos(bruto - descuentoNoAfecto);
      if (
        descuentoNoAfecto > 0 &&
        (total < 0 ||
          (typeof payload.montoTotal === 'number' &&
            Number.isFinite(payload.montoTotal) &&
            centimos(payload.montoTotal) !== total))
      ) {
        throw new Error(
          'El total del comprobante no concuerda con el descuento 01/03; requiere revisión contable.',
        );
      }
      return total;
    };

    /**
     * PRIORIDAD AL DESGLOSE YA DECLARADO EN EL PAYLOAD
     *
     * Si el payload trae `lineasTributarias` (lo hace la emisión desde pantalla,
     * que liquida línea por línea en `emitirComprobanteAdapter`), se usa ESE
     * desglose y no se recalcula nada.
     *
     * Recalcular aquí con `quantity × unit_value` daba cifras distintas de las
     * que se enviaron a SUNAT: SUNAT aceptaba un total de 1046.66 mientras el
     * asiento contable se armaba con 887 + 159.66 y no cuadraba ("debe 96.00
     * contra haber 0.00"). Es decir, el documento fiscal salía bien y la
     * contabilidad se descuadraba. Se detectó emitiendo de verdad: el CDR llegó
     * ACEPTADO y aun así el puente contable fallaba.
     *
     * La regla del proyecto es una sola verdad por cifra: la que se declaró en
     * el XML es la que se asienta.
     */
    const tributarias = payload.lineasTributarias;
    if (tributarias && tributarias.length > 0) {
      let gravado = 0;
      let igv = 0;
      let exonerado = 0;
      let inafecto = 0;
      let icbper = 0;

      for (const linea of tributarias) {
        const valor = Number(linea.valorVenta ?? 0);
        if (!Number.isFinite(valor)) continue;

        const afectacion = String(linea.afectacion ?? '');
        const esGratuita = gratuitas.has(afectacion);

        if (!esGratuita) {
          if (afectacion.startsWith('1')) gravado += valor;
          else if (afectacion.startsWith('2')) exonerado += valor;
          else inafecto += valor;
          icbper += Number(linea.icbper ?? 0) || 0;
        }
        igv += Number(linea.igv ?? 0) || 0;
      }

      let gravadoR = centimos(gravado);
      let igvR = centimos(igv);
      const exoneradoR = centimos(exonerado);
      const inafectoR = centimos(inafecto);
      const icbperR = centimos(icbper);
      if (payload.descuentoGlobal?.codigo === '02') {
        const global = aplicarDescuentoGlobal(
          {
            gravado: gravadoR,
            igv: igvR,
            exonerado: exoneradoR,
            inafecto: inafectoR,
            exportado: 0,
            icbper: icbperR,
          },
          payload.descuentoGlobal,
        );
        gravadoR = global.bases.gravado;
        igvR = global.bases.igv;
      }

      const detraccion = Number(payload.montoDetraccion ?? 0);
      const retencion = Number(payload.montoRetencion ?? 0);

      return {
        gravado: gravadoR,
        igv: igvR,
        exonerado: exoneradoR,
        inafecto: inafectoR,
        icbper: icbperR,
        detraccion: Number.isFinite(detraccion) ? detraccion : 0,
        retencion: Number.isFinite(retencion) ? retencion : 0,
        total: totalConDescuento(
          gravadoR + igvR + exoneradoR + inafectoR + icbperR,
        ),
        descuentoNoAfecto,
      };
    }

    // Camino anterior (integraciones que solo mandan líneas sin desglose).
    let gravado = 0;
    let exonerado = 0;
    let inafecto = 0;

    for (const item of items) {
      const afectacion = item.igv_affectation_type;
      const importe = Number(item.quantity) * Number(item.unit_value);
      if (!Number.isFinite(importe) || gratuitas.has(afectacion)) continue;

      if (afectacion.startsWith('10')) gravado += importe;
      else if (afectacion.startsWith('2')) exonerado += importe;
      else if (afectacion.startsWith('3') || afectacion.startsWith('4')) {
        inafecto += importe;
      }
    }

    const igv = centimos(gravado * 0.18);
    const gravadoR = centimos(gravado);

    // ICBPER y detracción vienen del payload cuando el comprobante los declara.
    const bolsas = Number(payload.bolsasIcBper ?? 0);
    const icbper = centimos(Number.isFinite(bolsas) ? bolsas * 0.5 : 0);
    const detraccion = Number(payload.montoDetraccion ?? 0);
    const retencion = Number(payload.montoRetencion ?? 0);

    return {
      gravado: gravadoR,
      igv,
      exonerado: centimos(exonerado),
      inafecto: centimos(inafecto),
      icbper,
      detraccion: Number.isFinite(detraccion) ? detraccion : 0,
      retencion: Number.isFinite(retencion) ? retencion : 0,
      total: totalConDescuento(gravadoR + igv + exonerado + inafecto + icbper),
      descuentoNoAfecto,
    };
  }

  /**
   * TA-58, criterio 2: el comprobante no se puede validar (falta la hoja XSL
   * oficial o su ejecucion fallo).
   *
   * Es un problema de INFRAESTRUCTURA, no del comprobante, asi que:
   *  - no se marca RECHAZADO: el XML puede estar perfecto;
   *  - no se manda a la DLQ ni se consume un intento del backoff;
   *  - el error se relanza para que pg-boss vuelva a entregar el job cuando
   *    la hoja exista. Devolver `null` dejaria el comprobante trabado en
   *    EN_COLA para siempre.
   *
   * `reintentableSinConsumirIntento` documenta justo esa intencion.
   */
  private bloqueoDeInfraestructura(
    invoiceId: string,
    error: ErrorValidacionBloqueada,
  ): never {
    this.logger.error(
      `[TA-58] ${invoiceId} no se puede validar (${error.motivo}): el job vuelve a la cola sin consumir intento`,
    );
    throw error;
  }

  /**
   * Genera el asiento de venta con el caso de uso de contabilidad (P0).
   *
   * RESPALDO, no la vía principal: el puente de TA-68 es quien asienta las
   * ventas aceptadas. Esta ruta solo existe para el caso en que el puente no
   * haya dejado asiento —por ejemplo, cuando un SKU no está en el inventario y
   * el puente omite la partida—, y su idempotencia va por el UUID del
   * comprobante, distinta de la del puente (número de documento).
   */
  private async registrarAsiento(
    invoiceId: string,
    idAsientoDelPuente?: string,
  ): Promise<void> {
    if (!this.accounting) return;
    if (idAsientoDelPuente) return;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        company_id: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        fecha_emision: true,
        customer_legal_name: true,
        monto_total: true,
        total_igv: true,
        taxable_operations: true,
        payload_ubl: true,
      },
    });
    if (!invoice) return;
    if (
      invoice.tipo_comprobante !== '01' &&
      invoice.tipo_comprobante !== '03'
    ) {
      return;
    }

    const payload = (invoice.payload_ubl ?? {}) as Record<string, unknown>;
    const total = Number(invoice.monto_total);
    const numero = (valor: unknown): number | undefined => {
      const n = Number(valor);
      return Number.isFinite(n) ? n : undefined;
    };

    // El payload UBL es la fuente primaria: distingue una operación gravada
    // (IGV > 0) de una exonerada (IGV = 0). Los campos de la fila son el
    // respaldo para comprobantes antiguos que no los traían.
    const payloadIgv = numero(payload.montoIgv);
    const payloadBase = numero(payload.montoGravado);
    const totalIgv = numero(invoice.total_igv);
    const taxable = numero(invoice.taxable_operations);
    const igv =
      payloadIgv ??
      (totalIgv && totalIgv > 0
        ? totalIgv
        : Math.round((total - total / 1.18) * 100) / 100);
    const base =
      payloadBase && payloadBase > 0
        ? payloadBase
        : taxable && taxable > 0
          ? taxable
          : Math.round((total - igv) * 100) / 100;

    await this.accounting.execute({
      companyId: invoice.company_id,
      invoiceId: invoice.id,
      tipoComprobante: invoice.tipo_comprobante,
      serie: invoice.serie,
      correlativo: invoice.correlativo,
      fechaEmision: invoice.fecha_emision.toISOString().slice(0, 10),
      cliente: invoice.customer_legal_name ?? 'CLIENTE',
      base,
      igv,
      total,
    });
  }

  /** Traduce `{ invoice_id }` a los datos completos del envio. */
  async preparar(invoiceId: string): Promise<JobAprobado> {
    const invoice = await this.cargar(invoiceId);
    const xmlSinFirma = this.xmlDelComprobante(invoice);
    const context = await this.issuerConfig?.resolve(invoice.company_id);
    const xml = this.firmar(invoice, xmlSinFirma, context);
    const zip = this.comprimir(invoice, xml);

    // SE GUARDA EL XML FIRMADO, el que se envía.
    //
    // Antes no se guardaba y la descarga regeneraba el documento desde el
    // payload, entregando un XML SIN `<ds:Signature>`: un archivo con el nombre
    // del comprobante que no era el que viajó a SUNAT. Se detectó abriendo el
    // XML descargado el 31-10.
    //
    // Va antes de la compuerta XSL para que la copia exista incluso si el envío
    // se bloquea: el documento firmado ya es un hecho y hay que poder auditarlo.
    const hashGuardado = await this.xmlFirmado.guardar(invoiceId, xml);
    if (hashGuardado) {
      this.logger.log(
        `XML firmado de ${invoice.serie}-${invoice.correlativo} guardado (sha256 ${hashGuardado.slice(0, 16)}…)`,
      );
    }

    const params: SendInvoiceParams = {
      companyId: invoice.company_id,
      context,
      invoiceId: invoice.id,
      rucEmisor: invoice.ruc_emisor,
      tipoComprobante: invoice.tipo_comprobante,
      serie: invoice.serie,
      correlativo: invoice.correlativo,
      zip,
      estadoActual: invoice.estado,
    };

    // TA-58: la compuerta va DESPUES de firmar, porque la hoja oficial valida
    // el XML tal como se envia (el `ds:DigestValue` forma parte del
    // documento). Puede lanzar `ErrorValidacionBloqueada`, que se captura en
    // `procesar()`.
    //
    // TA-58/DEUDA: `decidirEnvio` es el mismo camino, pero ademas informa si la
    // compuerta se omitio por la bandera de demostracion. Cuando eso pasa el
    // aviso sale por consola con nivel WARN para que se vea en la terminal
    // durante la exposicion y no solo en el historial.
    const decision = await decidirEnvio(
      params,
      xml,
      this.xslValidator,
      this.cdrPersistence,
    );
    if (decision.noConcluyente) {
      // Incluye XML ya firmado en intentos anteriores: esa ruta antes no se
      // volvía a comprobar. El servicio actual aplica estructura y negocio;
      // no ejecuta los esquemas XSD oficiales completos.
      const comprobacion = this.xsdValidator.validateInvoiceUbl21(xml);
      if (!comprobacion.isValid) {
        throw new Error(
          `XML invalido contra comprobaciones UBL: ${(comprobacion.errors ?? []).join(' | ')}`,
        );
      }
      await this.cdrPersistence.persistFailure({
        invoiceId: invoice.id,
        estadoNuevo: invoice.estado,
        estadoAnterior: invoice.estado,
        intento: params.intento ?? 1,
        codigoError: null,
        mensajeError:
          'Validación XSL no concluyente: falta commons/error/validate_utils.xsl; el despacho se apoya en comprobaciones estructurales UBL y reglas internas, no en una validación XSD oficial completa.',
        tiempoRespuestaMs: null,
      });
    }
    if (decision.omitidaPorDemo) {
      this.logger.warn(`[WARN][DEMO] ${invoiceId}: ${AVISO_DEMO}`);
    }

    return {
      // Un XML que ya traia la firma tampoco se vuelve a firmar: cuenta como
      // firmado porque el sobre sale con XMLDSig.
      firmado: xml.includes('<ds:Signature'),
      params,
      bloqueoXsl: decision.bloqueo,
      omitidaPorDemo: decision.omitidaPorDemo,
    };
  }

  /** Lee el comprobante y rechaza los que ya estan en estado final. */
  private async cargar(invoiceId: string): Promise<InvoiceRow> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        company_id: true,
        ruc_emisor: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        estado: true,
        payload_ubl: true,
        xml_storage_url: true,
      },
    });

    if (!invoice) {
      throw new Error(`Comprobante ${invoiceId} no existe en la base de datos`);
    }

    const finales: InvoiceStatus[] = [
      InvoiceStatus.ACEPTADO,
      InvoiceStatus.OBSERVADO,
      InvoiceStatus.RECHAZADO,
      InvoiceStatus.ANULADO,
    ];
    if (finales.includes(invoice.estado)) {
      throw new Error(
        `Comprobante ${invoiceId} ya tiene estado final ${invoice.estado}: no se reenvia`,
      );
    }

    return invoice as InvoiceRow;
  }

  /**
   * Devuelve el XML del comprobante.
   *
   * Primero intenta el guardado por el worker de TA-11 en `xml_storage_url`;
   * si no existe, lo genera desde `payload_ubl` y lo valida contra el XSD.
   */
  private xmlDelComprobante(invoice: InvoiceRow): string {
    const guardado = invoice.xml_storage_url;
    if (guardado && guardado.trimStart().startsWith('<?xml')) return guardado;

    const payload = invoice.payload_ubl as InvoicePayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Comprobante ${invoice.id} sin payload_ubl: no se puede generar el XML`,
      );
    }

    const xml = this.ublGenerator.generateInvoiceXml(payload);
    const validacion = this.xsdValidator.validateInvoiceUbl21(xml);
    if (!validacion.isValid) {
      const detalle = (validacion.errors ?? []).join(' | ');
      throw new Error(`XML invalido contra UBL 2.1: ${detalle}`);
    }
    return xml;
  }

  /** Firma XMLDSig X.509. Sin certificado configurado el XML viaja sin firmar. */
  private firmar(
    invoice: InvoiceRow,
    xml: string,
    context?: IssuerContext,
  ): string {
    if (xml.includes('<ds:Signature')) return xml;
    if (context ? !context.certificate : !process.env.CERT_BASE64) {
      this.logger.warn(
        `[TA-28] ${invoice.id} viaja SIN firma: CERT_BASE64 no esta configurado`,
      );
      return xml;
    }
    return this.signature.signXml(xml, context).signedXml;
  }

  /** Empaqueta en el ZIP con la convencion de nombre que espera SUNAT. */
  private comprimir(invoice: InvoiceRow, xml: string): Buffer {
    const fileName = buildZipFileName({
      ruc: invoice.ruc_emisor,
      tipoComprobante: invoice.tipo_comprobante,
      serie: invoice.serie,
      correlativo: invoice.correlativo,
    });

    const zip = new AdmZip();
    zip.addFile(fileName.replace(/\.zip$/i, '.xml'), Buffer.from(xml, 'utf8'));
    return zip.toBuffer();
  }

  /**
   * Hash SHA-256 del XML: huella del contenido enviado, util para detectar
   * modificaciones posteriores. Se guarda en `xml_hash_sha256`.
   */
  hashDelXml(xml: string): string {
    return createHash('sha256').update(xml, 'utf8').digest('hex');
  }

  private async marcar(
    invoiceId: string,
    estado: InvoiceStatus,
  ): Promise<void> {
    await this.prisma.invoice
      .update({ where: { id: invoiceId }, data: { estado } })
      .catch(() => null);
  }
}
