/**
 * Consulta de comprobantes (TA-29): listado, detalle y reintento de CDR.
 *
 * Las tres operaciones comparten una regla que es el corazón del criterio 4:
 * la empresa sale SIEMPRE del token y un comprobante de otra empresa responde
 * 404, no 403. Se elige 404 a propósito para no filtrar la existencia del
 * recurso: si respondiera 403, un atacante sabría que el id es válido en otra
 * organización (IDOR por enumeración).
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import type { InvoiceStatus } from '../../../../generated/client/enums';
import type {
  ComprobanteDetalleDto,
  FiltrosComprobantes,
  PaginaComprobantesDto,
  ReintentoCdrDto,
} from '../dto/invoiceQueryDto';
import { construirWhere, normalizarPaginacion } from './invoiceQueryFilters';
import {
  aComprobanteOrigenFallback,
  aDetalle,
  aListado,
  numeroComprobante,
  type FilaDetalle,
  type FilaListado,
} from './invoiceQueryMapper';

/** Estados en los que tiene sentido reencolar el comprobante. */
const ESTADOS_REINTENTABLES = ['ERROR_RED', 'ENVIADO', 'RECHAZADO'];

/** Proyección del listado: solo lo que la grilla necesita. */
const SELECT_LISTADO = {
  id: true,
  tipo_comprobante: true,
  serie: true,
  correlativo: true,
  fecha_emision: true,
  estado: true,
  monto_total: true,
  currency_code: true,
  customer_identity_number: true,
  customer_legal_name: true,
  sunat_response_code: true,
  // Montos tributarios: la grilla muestra base e IGV reales, no derivados.
  taxable_operations: true,
  total_igv: true,
  exempt_operations: true,
  unaffected_operations: true,
  referenced_invoice_id: true,
  referenced_document_type: true,
  referenced_series_correlative: true,
  credit_debit_reason_code: true,
  xml_hash_sha256: true,
  payload_ubl: true,
  cdr_sunat: true,
  history: { where: { estado_nuevo: 'RECHAZADO' as const }, orderBy: { created_at: 'desc' as const }, take: 20,
    select: { estado_nuevo: true, codigo_error: true, mensaje_error: true, created_at: true } },
} as const;

/** Proyección del detalle: la del listado más ficha, CDR e historial. */
const SELECT_DETALLE = {
  ...SELECT_LISTADO,
  ruc_emisor: true,
  taxable_operations: true,
  total_igv: true,
  cdr_sunat: true,
  /**
   * Payload UBL del que se generó el XML.
   *
   * Es el ÚNICO sitio donde vive la forma de pago y el cronograma: `invoices`
   * no tiene columnas para eso. Sin proyectarlo, el detalle no puede decir si
   * una factura fue al crédito ni con cuántas cuotas.
   */
  payload_ubl: true,
  /**
   * Referencia de una nota al documento que afecta.
   *
   * Se guardaban desde `cc5572c` pero no se proyectaban, así que el detalle no
   * las devolvía y la pantalla seguía mostrando una nota aceptada sin origen ni
   * motivo aunque las columnas estuvieran bien rellenas.
   */
  referenced_document_type: true,
  referenced_series_correlative: true,
  credit_debit_reason_code: true,
  /** SHA-256 del XML firmado, para verificar la descarga. */
  xml_hash_sha256: true,
  created_at: true,
  updated_at: true,
  history: {
    select: {
      id: true,
      intento: true,
      estado_anterior: true,
      estado_nuevo: true,
      codigo_error: true,
      mensaje_error: true,
      tiempo_respuesta_ms: true,
      created_at: true,
    },
  },
} as const;

@Injectable()
export class InvoiceQueryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  /** Catálogo M1: precio final PEN, nunca costo promedio como recambio. */
  async catalogoProductos(companyId: string, almacen = 'ALM-01') {
    const [productos, saldos] = await Promise.all([
      this.prisma.inventoryProduct.findMany({
        where: { company_id: companyId, is_active: true },
        select: { id: true, sku: true, description: true, sunat_unit_code: true, tax_affectation: true, sale_price: true },
        orderBy: { sku: 'asc' },
      }),
      this.prisma.inventoryBalance.findMany({
        where: { company_id: companyId, warehouse: { warehouse_code: almacen } },
        select: { product_id: true, current_stock: true },
      }),
    ]);
    return { balances: productos.map(p => {
      const precio = Number(p.sale_price);
      const vendible = Number.isFinite(precio) && precio > 0;
      const stock = saldos.filter(s => s.product_id === p.id).reduce((sum, s) => sum + (Number(s.current_stock) || 0), 0);
      return { sku: p.sku, description: p.description, sunatUnitCode: p.sunat_unit_code,
        taxAffectation: p.tax_affectation?.trim() || null, currentStock: stock,
        salePrice: vendible ? precio : null, vendible,
        motivo: vendible ? null : 'sin precio de venta configurado' };
    }) };
  }

  almacenes(companyId: string) {
    return this.prisma.inventoryWarehouse.findMany({ where: { company_id: companyId, is_active: true },
      select: { warehouse_code: true, description: true }, orderBy: { warehouse_code: 'asc' } });
  }

  /** Listado paginado con filtros por estado, tipo, serie y fechas. */
  async listar(
    companyId: string,
    filtros: FiltrosComprobantes,
    page?: string,
    pageSize?: string,
  ): Promise<PaginaComprobantesDto> {
    const where = construirWhere(companyId, filtros);
    const paginacion = normalizarPaginacion(page, pageSize);

    // Las dos consultas van en una transacción para que el total y la página
    // correspondan al mismo instante: si otra petición inserta una factura
    // entre ambas, la UI mostraría un total que no cuadra con las filas.
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: SELECT_LISTADO,
        orderBy: [{ fecha_emision: 'desc' }, { correlativo: 'desc' }],
        skip: paginacion.skip,
        take: paginacion.page_size,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const filasConOrigen = await this.adjuntarComprobantesOrigen(
      companyId,
      filas as FilaListado[],
    );

    return {
      data: filasConOrigen.map(aListado),
      total,
      page: paginacion.page,
      page_size: paginacion.page_size,
      total_pages: Math.max(1, Math.ceil(total / paginacion.page_size)),
    };
  }

  /** Detalle con el CDR y el historial completo de estados. */
  async detalle(companyId: string, id: string): Promise<ComprobanteDetalleDto> {
    const fila = await this.prisma.invoice.findFirst({
      where: { id, company_id: companyId },
      select: SELECT_DETALLE,
    });

    if (!fila) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'El comprobante no existe o no pertenece a la empresa',
      });
    }

    const [filaConOrigen] = await this.adjuntarComprobantesOrigen(companyId, [
      fila as FilaDetalle,
    ]);
    return aDetalle(filaConOrigen as FilaDetalle);
  }

  /**
   * Resuelve los comprobantes origen de las notas (07/08) dentro de la empresa.
   */
  private async adjuntarComprobantesOrigen<T extends FilaListado>(
    companyId: string,
    filas: T[],
  ): Promise<T[]> {
    const notas = filas.filter(
      (f) => f.tipo_comprobante === '07' || f.tipo_comprobante === '08',
    );
    if (notas.length === 0) return filas;

    const idsOrigen = Array.from(
      new Set(
        notas
          .map((n) => n.referenced_invoice_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const paresSerieCorr = notas
      .filter((n) => !n.referenced_invoice_id && n.referenced_series_correlative)
      .map((n) => {
        const m = /^([A-Za-z0-9]+)-(\d+)$/.exec(
          n.referenced_series_correlative!.trim(),
        );
        return m ? { serie: m[1], correlativo: Number(m[2]) } : null;
      })
      .filter(
        (p): p is { serie: string; correlativo: number } =>
          p !== null && Number.isFinite(p.correlativo),
      );

    const condicionesOr: Array<Record<string, unknown>> = [];
    if (idsOrigen.length > 0) {
      condicionesOr.push({ id: { in: idsOrigen } });
    }
    for (const par of paresSerieCorr) {
      condicionesOr.push({ serie: par.serie, correlativo: par.correlativo });
    }

    const origenes =
      condicionesOr.length > 0 && typeof this.prisma.invoice?.findMany === 'function'
        ? await this.prisma.invoice.findMany({
            where: {
              company_id: companyId,
              OR: condicionesOr,
            },
            select: {
              id: true,
              tipo_comprobante: true,
              serie: true,
              correlativo: true,
              customer_identity_number: true,
              customer_legal_name: true,
              monto_total: true,
              currency_code: true,
            },
          })
        : [];

    const porId = new Map(origenes.map((o) => [o.id, o]));
    const porNumero = new Map(
      origenes.map((o) => [
        numeroComprobante(o.serie, o.correlativo).toUpperCase(),
        o,
      ]),
    );
    const porSerieCorrCorto = new Map(
      origenes.map((o) => [(o.serie + '-' + String(o.correlativo)).toUpperCase(), o]),
    );

    return filas.map((fila) => {
      if (fila.tipo_comprobante !== '07' && fila.tipo_comprobante !== '08') {
        return { ...fila, comprobante_origen: null };
      }
      const refNum = fila.referenced_series_correlative?.trim().toUpperCase() ?? '';
      const origenDb =
        (fila.referenced_invoice_id
          ? porId.get(fila.referenced_invoice_id)
          : undefined) ??
        (refNum ? porNumero.get(refNum) ?? porSerieCorrCorto.get(refNum) : undefined) ??
        null;

      return {
        ...fila,
        comprobante_origen: aComprobanteOrigenFallback(fila, origenDb),
      };
    });
  }

  /**
   * Reencola un comprobante en error y deja constancia en la auditoría.
   *
   * "Reintento de CDR" significa volver a preguntar por el estado de un
   * comprobante que quedó en error, no reenviarlo a ciegas: el reenvío lo
   * decide la capa de resiliencia después de conciliar (TA-30 y TA-32).
   */
  async reintentarCdr(
    companyId: string,
    id: string,
  ): Promise<ReintentoCdrDto> {
    const fila = await this.prisma.invoice.findFirst({
      where: { id, company_id: companyId },
      select: { id: true, estado: true, serie: true, correlativo: true },
    });

    if (!fila) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'El comprobante no existe o no pertenece a la empresa',
      });
    }

    if (fila.estado === 'EN_COLA' || fila.estado === 'PENDIENTE') {
      // Un rescate histórico sin marcador no demuestra que nunca se abrió red.
      // Confirmar la incertidumbre antes de publicar; false/true existentes se conservan.
      await this.prisma.invoice.updateMany({
        where: { id: fila.id, company_id: companyId, estado: { in: ['EN_COLA', 'PENDIENTE'] }, transport_uncertain: null },
        data: { transport_uncertain: true },
      });
      let estadoActual: InvoiceStatus = fila.estado;
      const resultado = await this.queue.reenqueueInvoiceIfIdle(fila.id, companyId, async () => {
        const actual = await this.prisma.invoice.findFirst({
          where: { id: fila.id, company_id: companyId },
          select: { estado: true },
        });
        if (!actual) return false;
        estadoActual = actual.estado;
        return actual.estado === 'EN_COLA' || actual.estado === 'PENDIENTE';
      }, { rescatarDlq: true });
      const numero = `${fila.serie}-${String(fila.correlativo).padStart(8, '0')}`;
      const explicacion = {
        ENCOLADO: 'Comprobante reencolado manualmente.',
        YA_EN_COLA: 'Ya existe un trabajo en cola; no se duplicó.',
        EN_DLQ: 'El comprobante está en la cola de muertos y requiere revisión manual.',
        ESTADO_NO_PERMITIDO: 'El estado ya no permite reencolar el comprobante.',
      }[resultado.estado];
      await this.prisma.transactionHistory.create({
        data: { company_id: companyId, invoice_id: fila.id, intento: 1,
          estado_anterior: estadoActual, estado_nuevo: estadoActual,
          codigo_error: null, mensaje_error: `Rescate manual ${numero}: ${resultado.estado}. ${explicacion}`,
          tiempo_respuesta_ms: null },
      });
      return { id: fila.id, estado: estadoActual, encolado: resultado.estado === 'ENCOLADO',
        mensaje: explicacion, resultadoCola: resultado.estado };
    }

    // Se rechaza el reintento de un comprobante que ya está resuelto: reencolar
    // una factura ACEPTADA haría que el worker la reenviara y SUNAT la
    // rechazara por duplicado (1033).
    if (!ESTADOS_REINTENTABLES.includes(fila.estado)) {
      return {
        id: fila.id,
        estado: fila.estado,
        encolado: false,
        mensaje: `El comprobante está en estado ${fila.estado} y no admite reintento`,
      };
    }

    let encolado = false;
    let mensaje: string;

    if (typeof this.queue.reenqueueInvoiceIfIdle === 'function') {
      const resultado = await this.queue.reenqueueInvoiceIfIdle(
        fila.id,
        companyId,
        async () => {
          const actual = await this.prisma.invoice.findUnique({
            where: { id: fila.id },
            select: { estado: true },
          });
          if (!actual || !ESTADOS_REINTENTABLES.includes(actual.estado)) return false;
          await this.prisma.invoice.updateMany({ where: { id: fila.id, company_id: companyId, estado: { in: ESTADOS_REINTENTABLES as InvoiceStatus[] }, transport_uncertain: null }, data: { transport_uncertain: true } });
          return true;
        },
        { rescatarDlq: true },
      );
      encolado = resultado.estado === 'ENCOLADO';
      mensaje = {
        ENCOLADO: 'El comprobante se reencoló para consultar su CDR',
        YA_EN_COLA: 'El comprobante ya tiene un job activo; no se duplicó',
        EN_DLQ: 'El comprobante está en la DLQ; requiere revisión manual',
        ESTADO_NO_PERMITIDO: 'El comprobante cambió de estado y ya no admite reintento',
      }[resultado.estado];
    } else {
      const jobId = await this.queue.enqueueInvoiceInTx(
        this.transaccionDePrisma(),
        fila.id,
      );
      encolado = jobId !== null;
      mensaje = encolado
        ? 'El comprobante se reencoló para consultar su CDR'
        : 'El comprobante no se pudo reencolar: la cola no está disponible';
    }

    await this.prisma.auditLog.create({
      data: {
        company_id: companyId,
        module: 'M1_FACTURACION',
        action: 'RETRY_CDR',
        entity_name: 'Invoice',
        entity_id: fila.id,
        ip_address: 'desconocida',
        digest_hash: `${fila.id}:RETRY_CDR:${Date.now()}`,
      },
    });

    return {
      id: fila.id,
      estado: fila.estado,
      encolado,
      mensaje,
    };
  }

  /**
   * Cliente transaccional que espera `enqueueInvoiceInTx`.
   *
   * El reencolado no necesita atomicidad con ninguna escritura de negocio (el
   * comprobante ya existía), así que se pasa el propio prisma. Se usa un método
   * separado para dejar constancia de que la decisión fue deliberada.
   */
  private transaccionDePrisma() {
    return this.prisma as unknown as {
      $queryRawUnsafe<T = unknown>(
        query: string,
        ...values: unknown[]
      ): Promise<T>;
    };
  }
}
