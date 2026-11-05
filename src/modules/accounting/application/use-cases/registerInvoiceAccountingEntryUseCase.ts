import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';
import { GenerateAccountingEntryUseCase } from './generateAccountingEntryUseCase';

/** Datos mínimos del comprobante aceptado para generar su asiento. */
export interface InvoiceAccountingInput {
  companyId: string;
  invoiceId: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  /** Fecha de emisión en formato `YYYY-MM-DD`. */
  fechaEmision: string;
  cliente: string;
  base: number;
  igv: number;
  total: number;
}

/** Cuentas PCGE base para una venta gravada. */
const CUENTAS = {
  porCobrar: { code: '12121', name: 'Facturas por cobrar emitidas' },
  ventas: { code: '70121', name: 'Ventas gravadas' },
  igv: { code: '40111', name: 'IGV - Cuenta propia' },
  otrosTributos: { code: '401119', name: 'Otros tributos por pagar' },
} as const;

const redondear = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100;

/** Asiento de venta idempotente por comprobante aceptado. */
@Injectable()
export class RegisterInvoiceAccountingEntryUseCase {
  private readonly logger = new Logger(RegisterInvoiceAccountingEntryUseCase.name);

  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly accountingRepository: IAccountingRepositoryPort,
    private readonly generateEntry: GenerateAccountingEntryUseCase,
  ) {}

  async execute(
    input: InvoiceAccountingInput,
  ): Promise<AccountingEntryEntity | null> {
    if (input.tipoComprobante !== '01' && input.tipoComprobante !== '03') {
      return null;
    }

    const total = redondear(input.total);
    const igv = redondear(input.igv);
    const base = redondear(input.base);
    if (total <= 0 || base <= 0 || base + igv > total + 0.01) {
      this.logger.warn(
        `[INVOICES] ${input.invoiceId} sin montos contables válidos; no se genera asiento`,
      );
      return null;
    }

    const yaExiste =
      await this.accountingRepository.existsBySourceReference(
        input.companyId,
        'INVOICES',
        input.invoiceId,
      );
    if (yaExiste) return null;

    const period = input.fechaEmision.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      this.logger.warn(
        `[INVOICES] ${input.invoiceId} con fecha inválida ${input.fechaEmision}`,
      );
      return null;
    }

    const otros = redondear(total - base - igv);

    const lines = [
      {
        lineOrder: 1,
        accountCode: CUENTAS.porCobrar.code,
        accountName: CUENTAS.porCobrar.name,
        debitAmount: total,
        creditAmount: 0,
      },
      {
        lineOrder: 2,
        accountCode: CUENTAS.ventas.code,
        accountName: CUENTAS.ventas.name,
        debitAmount: 0,
        creditAmount: base,
      },
      ...(igv > 0
        ? [
            {
              lineOrder: 3,
              accountCode: CUENTAS.igv.code,
              accountName: CUENTAS.igv.name,
              debitAmount: 0,
              creditAmount: igv,
            },
          ]
        : []),
      ...(otros > 0.01
        ? [
            {
              lineOrder: 4,
              accountCode: CUENTAS.otrosTributos.code,
              accountName: CUENTAS.otrosTributos.name,
              debitAmount: 0,
              creditAmount: otros,
            },
          ]
        : []),
    ];

    return this.generateEntry.execute({
      companyId: input.companyId,
      period,
      entryDate: `${input.fechaEmision}T00:00:00.000Z`,
      glosa: `Venta ${input.serie}-${input.correlativo} · ${input.cliente}`,
      sourceModule: 'INVOICES',
      sourceReferenceId: input.invoiceId,
      lines,
    });
  }
}
