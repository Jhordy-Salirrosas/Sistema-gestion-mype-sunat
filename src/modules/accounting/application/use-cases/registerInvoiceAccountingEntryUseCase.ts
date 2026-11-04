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

/**
 * Mapeo PCGE base para una venta gravada.
 *
 * Se usan cuentas de 3 dígitos del Plan Contable General Empresarial:
 *  - 121101: cuentas por cobrar comerciales (activo).
 *  - 701111: ventas de mercaderías (ingreso).
 *  - 401111: IGV cuenta propia (pasivo).
 *
 * El mapeo es deliberadamente simple: cuando exista el maestro de cuentas por
 * producto/servicio, estas constantes se reemplazan por la configuración de la
 * empresa sin cambiar el flujo.
 */
const CUENTAS = {
  porCobrar: { code: '121101', name: 'Cuentas por cobrar comerciales' },
  ventas: { code: '701111', name: 'Ventas de mercaderías' },
  igv: { code: '401111', name: 'IGV - Cuenta propia' },
  otrosTributos: { code: '401119', name: 'Otros tributos por pagar' },
} as const;

const redondear = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100;

/**
 * Genera el asiento contable de una factura o boleta aceptada por SUNAT.
 *
 * Es idempotente por `(companyId, INVOICES, invoiceId)`: si el job se
 * reprocesa, no duplica el asiento. Las notas de crédito/débito quedan fuera
 * por ahora porque requieren revertir o ajustar el asiento original.
 */
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
