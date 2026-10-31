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
import type {
  ComprobanteDetalleDto,
  FiltrosComprobantes,
  PaginaComprobantesDto,
  ReintentoCdrDto,
} from '../dto/invoiceQueryDto';
import { construirWhere, normalizarPaginacion } from './invoiceQueryFilters';
import {
  aDetalle,
  aListado,
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
} as const;

/** Proyección del detalle: la del listado más ficha, CDR e historial. */
const SELECT_DETALLE = {
  ...SELECT_LISTADO,
  ruc_emisor: true,
  taxable_operations: true,
  total_igv: true,
  cdr_sunat: true,
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

    return {
      data: (filas as FilaListado[]).map(aListado),
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

    return aDetalle(fila as FilaDetalle);
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
      select: { id: true, estado: true },
    });

    if (!fila) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'El comprobante no existe o no pertenece a la empresa',
      });
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

    const jobId = await this.queue.enqueueInvoiceInTx(
      this.transaccionDePrisma(),
      fila.id,
    );

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
      encolado: jobId !== null,
      mensaje:
        jobId !== null
          ? 'El comprobante se reencoló para consultar su CDR'
          : 'El comprobante no se pudo reencolar: la cola no está disponible',
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
