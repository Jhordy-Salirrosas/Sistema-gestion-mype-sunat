import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import { PrismaService } from '../../../../database/prismaService';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  IInvoiceRepositoryPort,
  InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';

@Injectable()
export class PrismaInvoiceRepository implements IInvoiceRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async saveWithTransactionalOutbox(
    invoice: InvoiceEntity,
  ): Promise<InvoicePersistenceResult> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Registrar el comprobante dentro de la transacción.
          const created = await tx.invoice.create({
            data: {
              company_id: invoice.company_id,
              ruc_emisor: invoice.ruc_emisor,
              serie: invoice.serie,
              correlativo: invoice.correlativo,
              tipo_comprobante: invoice.tipo_comprobante,
              monto_total: invoice.monto_total,
              fecha_emision: invoice.fecha_emision,
              payload_ubl: invoice.payload_ubl as Prisma.InputJsonValue,
            },
            select: {
              id: true,
              estado: true,
              created_at: true,
            },
          });

          // Encolar el trabajo utilizando el cliente transaccional.
          await this.queueService.enqueueInvoiceInTx(tx, created.id);

          return created;
        },
      );
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        // TA-32 frente 1: si la llave que chocó es `uq_invoices_idempotencia`
        // (la misma empresa y el mismo RUC emisor), la petición es un reenvío
        // del MISMO comprobante y el criterio 2 exige responder 200 con el
        // registro existente. Si choca `uq_invoices_fiscal`, la serie ya está
        // tomada por otra empresa del mismo tenant y eso sí es un conflicto.
        if (esChoqueDeIdempotencia(error)) {
          return this.devolverExistente(invoice);
        }

        throw new ConflictException({
          code: 'INVOICE_ALREADY_EXISTS',
          message:
            'Ya existe un comprobante con esa serie y correlativo para la empresa',
        });
      }

      console.error('Error al registrar el comprobante:', error);

      throw new InternalServerErrorException({
        code: 'OUTBOX_WRITE_FAILED',
        message:
          'No se pudo registrar el comprobante ni encolar su procesamiento',
      });
    }
  }

  /**
   * Recupera el comprobante que ya estaba registrado (TA-32, criterio 2).
   *
   * Se busca por los cinco campos de la llave; si por alguna razón no
   * apareciera (carrera entre el commit de la otra petición y esta lectura),
   * se responde 409, que sigue siendo un resultado correcto para el cliente.
   */
  private async devolverExistente(
    invoice: InvoiceEntity,
  ): Promise<InvoicePersistenceResult> {
    const existente = await this.prisma.invoice.findFirst({
      where: {
        company_id: invoice.company_id,
        ruc_emisor: invoice.ruc_emisor,
        tipo_comprobante: invoice.tipo_comprobante,
        serie: invoice.serie,
        correlativo: invoice.correlativo,
      },
      select: { id: true, estado: true, created_at: true },
    });

    if (!existente) {
      throw new ConflictException({
        code: 'INVOICE_ALREADY_EXISTS',
        message:
          'El comprobante ya fue registrado por otra petición simultánea',
      });
    }

    return existente;
  }
}

/**
 * Comparación alfabética estable para ordenar nombres de campo.
 *
 * Sin comparador, `Array.prototype.sort` ordena por UTF-16 y el resultado es
 * dependiente de los datos; `localeCompare` hace explícito el criterio.
 */
function compararCampos(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Campos de la llave de idempotencia (TA-32), ya ordenados.
 *
 * Ordenados para poder compararlos con `camposViolados`, que también ordena:
 * Prisma no garantiza el orden en `meta.target`.
 */
const CAMPOS_LLAVE_IDEMPOTENCIA = [
  'company_id',
  'ruc_emisor',
  'tipo_comprobante',
  'serie',
  'correlativo',
].sort(compararCampos);

/** ¿El error es una violación del índice único (P2002)? */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Nombres de los campos que provocaron el P2002.
 *
 * Prisma los expone en `meta.target` como array de strings (algunos
 * controladores lo devuelven como un solo string con comas); se normaliza a
 * array ordenado para no depender de la forma exacta ni del orden.
 */
function camposViolados(error: unknown): string[] {
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;

  if (Array.isArray(target)) return target.map(String).sort(compararCampos);
  if (typeof target === 'string') {
    return target
      .split(',')
      .map((c) => c.trim())
      .sort(compararCampos);
  }
  return [];
}

/**
 * ¿El choque se produjo por la llave de idempotencia?
 *
 * Se compara el conjunto ordenado de campos: Prisma puede reportar el target
 * como array o como string, y el orden no está garantizado.
 */
function esChoqueDeIdempotencia(error: unknown): boolean {
  return (
    camposViolados(error).join(',') ===
    CAMPOS_LLAVE_IDEMPOTENCIA.join(',')
  );
}
