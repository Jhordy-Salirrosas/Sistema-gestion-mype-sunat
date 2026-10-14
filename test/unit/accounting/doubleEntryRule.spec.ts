import { BadRequestException } from '@nestjs/common';
import { DoubleEntryRule } from '../../../src/modules/accounting/domain/rules/doubleEntryRule';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

describe('DoubleEntryRule (Principio de Partida Doble)', () => {
  it('debe aceptar un asiento contable balanceado (Total Debe === Total Haber)', () => {
    const entry = new AccountingEntryEntity({
      companyId: 'comp-01',
      period: '2026-03',
      entryNumber: 1,
      entryDate: new Date('2026-03-15'),
      glosa: 'Venta de mercaderías según F001-00000001',
      sourceModule: 'INVOICES',
      lines: [
        {
          lineOrder: 1,
          accountCode: '1212',
          accountName: 'Emitidas en cartera',
          debitAmount: 118.0,
          creditAmount: 0.0,
        },
        {
          lineOrder: 2,
          accountCode: '40111',
          accountName: 'IGV - Cuenta propia',
          debitAmount: 0.0,
          creditAmount: 18.0,
        },
        {
          lineOrder: 3,
          accountCode: '70121',
          accountName: 'Mercaderías venta local',
          debitAmount: 0.0,
          creditAmount: 100.0,
        },
      ],
    });

    expect(() => DoubleEntryRule.validate(entry)).not.toThrow();
    expect(DoubleEntryRule.isBalanced(entry)).toBe(true);
  });

  it('debe rechazar con BadRequestException si el asiento está descuadrado', () => {
    const unbalancedEntry = new AccountingEntryEntity({
      companyId: 'comp-01',
      period: '2026-03',
      entryNumber: 2,
      entryDate: new Date('2026-03-15'),
      glosa: 'Asiento descuadrado intencional',
      sourceModule: 'INVOICES',
      lines: [
        {
          lineOrder: 1,
          accountCode: '1212',
          accountName: 'Emitidas en cartera',
          debitAmount: 120.0,
          creditAmount: 0.0,
        },
        {
          lineOrder: 2,
          accountCode: '70121',
          accountName: 'Mercaderías venta local',
          debitAmount: 0.0,
          creditAmount: 100.0,
        },
      ],
    });

    expect(() => DoubleEntryRule.validate(unbalancedEntry)).toThrow(
      BadRequestException,
    );
    expect(DoubleEntryRule.isBalanced(unbalancedEntry)).toBe(false);
  });

  it('debe rechazar un asiento que tenga menos de dos líneas', () => {
    const singleLineEntry = new AccountingEntryEntity({
      companyId: 'comp-01',
      period: '2026-03',
      entryNumber: 3,
      entryDate: new Date('2026-03-15'),
      glosa: 'Asiento con una sola línea',
      sourceModule: 'INVOICES',
      lines: [
        {
          lineOrder: 1,
          accountCode: '1212',
          accountName: 'Emitidas en cartera',
          debitAmount: 100.0,
          creditAmount: 0.0,
        },
      ],
    });

    expect(() => DoubleEntryRule.validate(singleLineEntry)).toThrow(
      BadRequestException,
    );
  });
});
