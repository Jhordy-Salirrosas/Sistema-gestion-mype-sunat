import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { InvoiceStatus } from '../../../../generated/client/enums';
import { redondearMoneda as centimos } from '../../money';
import type { InvoicePayload } from '../../invoicePayload';
import { aplicarDescuentoGlobal } from './descuentoGlobal';
import {
  InvoiceAccountingBridgeService,
  claveAsientoM1,
  type FacturaParaPuente,
  type ResultadoPuente,
} from './invoiceAccountingBridgeService';
import { InvoiceAccountingFallbackService } from './invoiceAccountingFallbackService';

export interface ResultadoReprocesoPuente {
  completo: boolean;
  yaCompleto: boolean;
  asientoId?: string;
  asientoOmitido: boolean;
  asientoCostoId?: string;
  costoVenta?: number;
  kardex: 'COMPLETO' | 'PENDIENTE';
  movimientosRegistrados: number;
  movimientosOmitidos: number;
  errores: readonly string[];
}

/** Solo efectos locales del puente; no conoce cola, firma ni transporte SUNAT. */
@Injectable()
export class InvoiceBridgeCoordinatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly puenteContable: InvoiceAccountingBridgeService,
    @Optional() private readonly accounting?: InvoiceAccountingFallbackService,
  ) {}

  async reprocesar(
    companyId: string,
    invoiceId: string,
  ): Promise<ResultadoReprocesoPuente> {
    if (!companyId)
      throw new ForbiddenException(
        'Empresa requerida para reprocesar el puente',
      );
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, company_id: companyId },
      select: { estado: true },
    });
    if (!invoice)
      throw new NotFoundException('El comprobante no existe en la empresa');
    if (
      invoice.estado !== InvoiceStatus.ACEPTADO &&
      invoice.estado !== InvoiceStatus.OBSERVADO
    ) {
      throw new BadRequestException(
        'Solo se puede reprocesar el puente de un comprobante ACEPTADO u OBSERVADO',
      );
    }
    return (await this.ejecutar(invoiceId, invoice.estado)).respuesta;
  }

  /** El worker conserva exactamente su contrato de relanzar efectos pendientes. */
  async registrarComoTrabajo(
    invoiceId: string,
    estado: InvoiceStatus,
  ): Promise<void> {
    const resultado = await this.ejecutar(invoiceId, estado);
    if (resultado.error) throw resultado.error;
  }

  private async ejecutar(
    invoiceId: string,
    estado: InvoiceStatus,
  ): Promise<{ respuesta: ResultadoReprocesoPuente; error?: Error }> {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m1:bridge:${invoiceId}`}, 0))`;
      const actual = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { estado: true } });
      if (!actual || ![InvoiceStatus.ACEPTADO, InvoiceStatus.OBSERVADO].includes(actual.estado as 'ACEPTADO' | 'OBSERVADO')) {
        throw new BadRequestException('Solo se puede reprocesar el puente de un comprobante ACEPTADO u OBSERVADO');
      }
      return this.ejecutarExclusivo(invoiceId, actual.estado);
    }, { timeout: 30000 });
  }

  private async ejecutarExclusivo(invoiceId: string, estado: InvoiceStatus): Promise<{ respuesta: ResultadoReprocesoPuente; error?: Error }> {
    const factura = await this.cargarParaPuente(invoiceId, estado);
    if (!factura) throw new Error('M1_ACCOUNTING_DOCUMENT_UNAVAILABLE');
    const resultado = await this.puenteContable.registrar(factura);
    const { error, respaldo } =
      resultado.completo && (resultado.asientoId || resultado.asientoOmitido)
        ? {}
        : await this.recuperarRespaldo(invoiceId, factura, resultado);
    const errores = respaldo
      ? resultado.errores.filter((e) => !e.startsWith('Contabilidad:'))
      : [...resultado.errores];
    if (error && !errores.length) errores.push(error.message);
    const completo = !error && (resultado.completo || errores.length === 0);
    return {
      error,
      respuesta: this.respuesta(resultado, completo, errores, respaldo),
    };
  }

  private async recuperarRespaldo(
    invoiceId: string,
    factura: FacturaParaPuente,
    resultado: ResultadoPuente,
  ): Promise<{ error?: Error; respaldo?: { id?: string; omitido: boolean } }> {
    if (
      factura.motivoBloqueoAsiento ||
      (factura.importes.descuentoNoAfecto ?? 0) > 0
    ) {
      return { error: new Error('M1_ACCOUNTING_REVIEW_REQUIRED') };
    }
    let respaldo: { id?: string; omitido: boolean } | undefined;
    if (!resultado.asientoId) {
      try {
        respaldo = await this.registrarAsiento(invoiceId);
      } catch (cause) {
        return {
          error:
            cause instanceof Error ? cause : new Error('M1_ACCOUNTING_PENDING'),
        };
      }
    }
    const error = resultado.errores.some((e) => !e.startsWith('Contabilidad:'))
      ? new Error('M1_KARDEX_PENDING')
      : undefined;
    return { respaldo, error };
  }

  private respuesta(
    resultado: ResultadoPuente,
    completo: boolean,
    errores: readonly string[],
    respaldo?: { id?: string; omitido: boolean },
  ): ResultadoReprocesoPuente {
    const asientoOmitido = respaldo?.omitido ?? resultado.asientoOmitido;
    return {
      completo,
      yaCompleto:
        completo &&
        resultado.movimientosRegistrados === 0 &&
        asientoOmitido &&
        (resultado.asientoCostoOmitido ?? !resultado.asientoCostoId),
      asientoId: respaldo?.id ?? resultado.asientoId,
      asientoOmitido,
      asientoCostoId: resultado.asientoCostoId,
      costoVenta: resultado.costoVenta,
      kardex: resultado.errores.some((e) => e.startsWith('Kardex '))
        ? 'PENDIENTE'
        : 'COMPLETO',
      movimientosRegistrados: resultado.movimientosRegistrados,
      movimientosOmitidos: resultado.movimientosOmitidos,
      errores,
    };
  }

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
        referenced_invoice_id: true,
        referenced_series_correlative: true,
        credit_debit_reason_code: true,
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
      almacen: payload.almacen,
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
      motivoNota: fila.credit_debit_reason_code ?? undefined,
      documentoAfectadoId: fila.referenced_invoice_id ?? undefined,
      documentoAfectadoNumero: fila.referenced_series_correlative ?? undefined,
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
  liquidarParaPuente(
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
      '37',
    ]);

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

  private async registrarAsiento(
    invoiceId: string,
    idAsientoDelPuente?: string,
  ): Promise<{ id?: string; omitido: boolean }> {
    if (!this.accounting) throw new Error('M1_ACCOUNTING_FALLBACK_UNAVAILABLE');
    if (idAsientoDelPuente) return { id: idAsientoDelPuente, omitido: true };

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
    if (!invoice) throw new Error('M1_ACCOUNTING_DOCUMENT_UNAVAILABLE');
    if (
      invoice.tipo_comprobante !== '01' &&
      invoice.tipo_comprobante !== '03'
    ) {
      return { omitido: true };
    }

    // El puente y el respaldo identifican la misma venta con referencias
    // distintas. Consultar ambas también cubre un puente sin id o un reproceso.
    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: invoice.company_id,
        OR: [
          {
            source_module: 'M1_INVOICES',
            source_reference_id: `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`,
          },
          { source_module: 'INVOICES', source_reference_id: invoice.id },
          { source_module: 'M1_INVOICES', source_reference_id: invoice.id },
          { idempotency_key: claveAsientoM1(invoice.id) },
        ],
      },
      select: { id: true },
    });
    if (existente) return { id: existente.id, omitido: true };

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
      (totalIgv && totalIgv > 0 ? totalIgv : centimos(total - total / 1.18));
    const base =
      payloadBase && payloadBase > 0
        ? payloadBase
        : taxable && taxable > 0
          ? taxable
          : centimos(total - igv);

    const entry = await this.accounting.execute({
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
    if (!entry) throw new Error('M1_ACCOUNTING_PENDING');
    return { id: entry.id, omitido: false };
  }
}
