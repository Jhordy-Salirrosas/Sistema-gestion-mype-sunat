import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceDto) {
    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          ruc_emisor: dto.ruc_emisor,
          serie: dto.serie,
          correlativo: dto.correlativo,
          tipo_comprobante: dto.tipo_comprobante,
          monto_total: dto.monto_total,
          fecha_emision: new Date(dto.fecha_emision),
          payload_ubl: dto.payload_ubl,
          // estado, id, created_at y updated_at los maneja Prisma por defecto
        },
        select: {
          id: true,
          estado: true,
          created_at: true,
        },
      });

      return invoice;
    } catch (error) {
      //console.error('ERROR PRISMA:', error);
      throw new InternalServerErrorException(
        'Error al registrar el comprobante',
      );
    }
  }
}
