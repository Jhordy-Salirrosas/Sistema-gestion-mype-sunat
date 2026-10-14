import { InvoiceEntity } from '../entities/invoiceEntity';

export const INVOICE_REPOSITORY_PORT = Symbol('INVOICE_REPOSITORY_PORT');

export interface InvoicePersistenceResult {
  id: string;
  estado: string;
  created_at: Date;
}

export interface IInvoiceRepositoryPort {
  saveWithTransactionalOutbox(
    invoice: InvoiceEntity,
  ): Promise<InvoicePersistenceResult>;
}
