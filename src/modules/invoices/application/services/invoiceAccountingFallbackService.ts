import { Injectable } from '@nestjs/common';
import type { InvoiceAccountingInput } from '../../../accounting/application/use-cases/registerInvoiceAccountingEntryUseCase';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { claveAsientoM1, MODULO_ORIGEN } from './invoiceAccountingBridgeService';

/** Respaldo de M1 usando la interfaz contable existente y la MISMA clave única del puente. */
@Injectable()
export class InvoiceAccountingFallbackService {
  constructor(private readonly generate: GenerateAccountingEntryUseCase) {}

  async execute(input: InvoiceAccountingInput) {
    if (!['01', '03'].includes(input.tipoComprobante)) return null;
    const total = Math.round(input.total * 100) / 100;
    const igv = Math.round(input.igv * 100) / 100;
    const base = Math.round(input.base * 100) / 100;
    if (total <= 0 || base <= 0 || base + igv > total + .01) return null;
    const otros = Math.round((total - base - igv) * 100) / 100;
    return this.generate.execute({
      companyId: input.companyId, period: input.fechaEmision.slice(0, 7), entryDate: `${input.fechaEmision}T00:00:00.000Z`,
      glosa: `Venta ${input.serie}-${input.correlativo} · ${input.cliente}`,
      sourceModule: MODULO_ORIGEN, sourceReferenceId: input.invoiceId,
      idempotencyKey: claveAsientoM1(input.invoiceId),
      lines: [
        { lineOrder: 1, accountCode: '12121', accountName: 'Facturas por cobrar emitidas', debitAmount: total, creditAmount: 0 },
        { lineOrder: 2, accountCode: '70121', accountName: 'Ventas gravadas', debitAmount: 0, creditAmount: base },
        ...(igv > 0 ? [{ lineOrder: 3, accountCode: '40111', accountName: 'IGV - Cuenta propia', debitAmount: 0, creditAmount: igv }] : []),
        ...(otros > 0 ? [{ lineOrder: 4, accountCode: '401119', accountName: 'Otros tributos por pagar', debitAmount: 0, creditAmount: otros }] : []),
      ],
    });
  }
}
