import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async create(dto: CreateInvoiceDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Registrar el comprobante dentro de la transacción.
        const invoice = await tx.invoice.create({
          data: {
            ruc_emisor: dto.ruc_emisor,
            serie: dto.serie,
            correlativo: dto.correlativo,
            tipo_comprobante: dto.tipo_comprobante,
            monto_total: dto.monto_total,
            fecha_emision: new Date(dto.fecha_emision),
            payload_ubl: dto.payload_ubl,
          },
          select: {
            id: true,
            estado: true,
            created_at: true,
          },
        });

        // Encolar el trabajo utilizando el cliente transaccional.
        await this.queueService.enqueueInvoiceInTx(
          tx,
          invoice.id,
        );

        // Devolver los datos del comprobante creado.
        return invoice;
      });
    } catch (error) {
      console.error(
        'Error al registrar el comprobante:',
        error,
      );

      throw new InternalServerErrorException({
        code: 'OUTBOX_WRITE_FAILED',
        message: 'No se pudo registrar el comprobante ni encolar su procesamiento',
      });
    }
  }
}