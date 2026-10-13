import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';

describe('ReconcileSireUseCase', () => {
  let useCase: ReconcileSireUseCase;

  beforeEach(() => {
    useCase = new ReconcileSireUseCase();
  });

  it('debería calcular la tasa de cumplimiento al 100% cuando todos los comprobantes coinciden', async () => {
    const record = {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '00000001',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
    };

    const result = await useCase.execute({
      period: '2026-03',
      bookType: 'RVIE_VENTAS',
      localRecords: [record],
      sireRecords: [record],
    });

    expect(result.totalLocalRecords).toBe(1);
    expect(result.totalSireRecords).toBe(1);
    expect(result.exactMatchesCount).toBe(1);
    expect(result.discrepanciesCount).toBe(0);
    expect(result.complianceRate).toBe(100);
  });

  it('debería calcular tasa de cumplimiento 0% cuando hay omisión', async () => {
    const record = {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '00000001',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
    };

    const result = await useCase.execute({
      period: '2026-03',
      bookType: 'RVIE_VENTAS',
      localRecords: [record],
      sireRecords: [],
    });

    expect(result.exactMatchesCount).toBe(0);
    expect(result.discrepanciesCount).toBe(1);
    expect(result.complianceRate).toBe(0);
  });
});
