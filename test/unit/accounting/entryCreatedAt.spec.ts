import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

/**
 * El detalle del asiento muestra cuándo se registró, que no es lo mismo que la
 * fecha contable: un asiento puede registrarse hoy con fecha de ayer.
 */
describe('AccountingEntryEntity · fecha de registro', () => {
  const crear = (extra: Record<string, unknown> = {}) =>
    new AccountingEntryEntity({
      id: 'e1',
      companyId: 'c1',
      period: '2026-11',
      entryNumber: 1,
      entryDate: new Date('2026-11-16T00:00:00Z'),
      glosa: 'Asiento de prueba',
      sourceModule: 'MANUAL',
      lines: [
        { lineOrder: 1, accountCode: '1011', accountName: 'Caja', debitAmount: 10, creditAmount: 0 },
        { lineOrder: 2, accountCode: '70121', accountName: 'Ventas', debitAmount: 0, creditAmount: 10 },
      ],
      ...extra,
    });

  it('expone createdAt cuando el repositorio lo entrega', () => {
    const asiento = crear({ createdAt: new Date('2026-11-16T13:05:00Z') });
    expect(asiento.createdAt?.toISOString()).toBe('2026-11-16T13:05:00.000Z');
  });

  it('lo deja opcional para no romper asientos creados en memoria', () => {
    expect(crear().createdAt).toBeUndefined();
  });
});
