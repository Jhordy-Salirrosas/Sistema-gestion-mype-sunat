import { RegisterInvoiceAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/registerInvoiceAccountingEntryUseCase';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

const ENTRADA = {
  companyId: 'company-1',
  invoiceId: 'invoice-1',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 42,
  fechaEmision: '2026-03-15',
  cliente: 'CLIENTE S.A.C.',
  base: 100,
  igv: 18,
  total: 118,
};

describe('RegisterInvoiceAccountingEntryUseCase', () => {
  let repository: jest.Mocked<IAccountingRepositoryPort>;
  let useCase: RegisterInvoiceAccountingEntryUseCase;

  beforeEach(() => {
    repository = {
      getNextEntryNumber: jest.fn().mockResolvedValue(7),
      saveEntry: jest.fn().mockImplementation(async (entry) => entry),
      findEntriesByPeriod: jest.fn().mockResolvedValue([]),
      existsBySourceReference: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<IAccountingRepositoryPort>;

    useCase = new RegisterInvoiceAccountingEntryUseCase(
      repository,
      new GenerateAccountingEntryUseCase(repository),
    );
  });

  it('genera un asiento cuadrado con las cuentas de venta, IGV y por cobrar', async () => {
    const entry = await useCase.execute(ENTRADA);

    expect(entry).not.toBeNull();
    expect(entry?.period).toBe('2026-03');
    expect(entry?.sourceModule).toBe('INVOICES');
    expect(entry?.sourceReferenceId).toBe('invoice-1');
    expect(entry?.getTotalDebit()).toBe(118);
    expect(entry?.getTotalCredit()).toBe(118);

    const cuentas = entry?.lines.map((linea) => linea.accountCode);
    expect(cuentas).toEqual(['12121', '70121', '40111']);
  });

  it('no duplica el asiento si la factura ya fue contabilizada', async () => {
    repository.existsBySourceReference.mockResolvedValue(true);

    const entry = await useCase.execute(ENTRADA);

    expect(entry).toBeNull();
    expect(repository.saveEntry).not.toHaveBeenCalled();
  });

  it('no genera asiento para notas de crédito o débito', async () => {
    const entry = await useCase.execute({
      ...ENTRADA,
      tipoComprobante: '07',
    });

    expect(entry).toBeNull();
    expect(repository.saveEntry).not.toHaveBeenCalled();
  });

  it('equilibra el asiento cuando el total trae ICBPER u otros conceptos', async () => {
    const entry = await useCase.execute({
      ...ENTRADA,
      total: 118.5,
    });

    expect(entry?.getTotalDebit()).toBe(118.5);
    expect(entry?.getTotalCredit()).toBe(118.5);
    expect(entry?.lines.map((linea) => linea.accountCode)).toContain('401119');
  });

  it('omite la línea de IGV cuando la operación es exonerada', async () => {
    const entry = await useCase.execute({
      ...ENTRADA,
      igv: 0,
      base: 118,
      total: 118,
    });

    expect(entry?.lines.map((linea) => linea.accountCode)).toEqual([
      '12121',
      '70121',
    ]);
    expect(entry?.getTotalDebit()).toBe(118);
    expect(entry?.getTotalCredit()).toBe(118);
  });
});
