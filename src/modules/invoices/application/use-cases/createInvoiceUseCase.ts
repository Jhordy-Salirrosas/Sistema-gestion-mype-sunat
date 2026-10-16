import { Inject, Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly invoiceRepository: IInvoiceRepositoryPort,
  ) {}

  async execute(dto: CreateInvoiceDto): Promise<InvoicePersistenceResult> {
    const entity = new InvoiceEntity({
      ruc_emisor: dto.ruc_emisor,
      serie: dto.serie,
      correlativo: dto.correlativo,
      tipo_comprobante: dto.tipo_comprobante,
      monto_total: dto.monto_total,
      fecha_emision: new Date(dto.fecha_emision),
      payload_ubl: dto.payload_ubl,
    });

    return this.invoiceRepository.saveWithTransactionalOutbox(entity);
  }
}
