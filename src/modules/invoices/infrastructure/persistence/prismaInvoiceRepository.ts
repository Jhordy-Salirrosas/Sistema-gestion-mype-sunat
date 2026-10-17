import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
      console.error('Error al registrar el comprobante:', error);

      throw new InternalServerErrorException({
        code: 'OUTBOX_WRITE_FAILED',
        message:
          'No se pudo registrar el comprobante ni encolar su procesamiento',
      });
    }
  }
}
