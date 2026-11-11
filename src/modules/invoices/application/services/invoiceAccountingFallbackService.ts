import { Injectable } from '@nestjs/common';
import type { InvoiceAccountingInput } from '../../../accounting/application/use-cases/registerInvoiceAccountingEntryUseCase';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

/** Respaldo de M1 usando la interfaz contable existente y la MISMA clave única del puente. */
@Injectable()
export class InvoiceAccountingFallbackService {
  constructor(_generate: GenerateAccountingEntryUseCase) {}

  async execute(_input: InvoiceAccountingInput): Promise<never> {
    throw new Error('M1_ACCOUNTING_PENDING: cuentas de respaldo retiradas; complete el mapeo contable y reprocesar puente.');
  }
}
