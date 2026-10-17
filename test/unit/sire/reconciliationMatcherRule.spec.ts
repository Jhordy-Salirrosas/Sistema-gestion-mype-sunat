import { ReconciliationMatcherRule } from '../../../src/modules/sire/domain/rules/reconciliationMatcherRule';
import type { SireRecord } from '../../../src/modules/sire/domain/entities/sireProposalEntity';

describe('ReconciliationMatcherRule', () => {
  const localInvoice: SireRecord = {
    emitterRuc: '20100070970',
    documentType: '01',
    series: 'F001',
    correlative: '00000001',
    taxableBase: 100.0,
    igvAmount: 18.0,
    totalAmount: 118.0,
  };

  it('debería clasificar como COINCIDENCIA_EXACTA con tolerancia de centavos (<= 0.05)', () => {
    const sireProposal: SireRecord = {
      ...localInvoice,
      taxableBase: 100.05,
      igvAmount: 18.05,
      totalAmount: 118.1,
    };

    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [sireProposal],
    );

    expect(summary.exactMatchesCount).toBe(1);
    expect(summary.discrepanciesCount).toBe(0);
    expect(summary.details[0].discrepancyType).toBe('COINCIDENCIA_EXACTA');
  });

  it('debería clasificar como DIFERENCIA_MONTOS cuando excede tolerancia de 0.05', () => {
    const sireProposal: SireRecord = {
      ...localInvoice,
      taxableBase: 100.06,
      igvAmount: 18,
      totalAmount: 118.06,
    };

    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [sireProposal],
    );

    expect(summary.exactMatchesCount).toBe(0);
    expect(summary.discrepanciesCount).toBe(1);
    expect(summary.details[0].discrepancyType).toBe('DIFERENCIA_MONTOS');
    expect(summary.details[0].amountDifference).toBe(0.06);
    expect(summary.details[0].taxableBaseDifference).toBe(-0.06);
    expect(summary.details[0].deviationPercentage).toBe(0.05);
  });

  it('debería detectar diferencias de IGV mayores a 0.05', () => {
    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [{ ...localInvoice, igvAmount: 18.06 }],
    );

    expect(summary.details[0].discrepancyType).toBe('DIFERENCIA_MONTOS');
    expect(summary.details[0].igvDifference).toBe(-0.06);
  });

  it('debería clasificar como OMISION_SUNAT cuando un comprobante local no figura en SUNAT', () => {
    const summary = ReconciliationMatcherRule.reconcile([localInvoice], []);

    expect(summary.exactMatchesCount).toBe(0);
    expect(summary.discrepanciesCount).toBe(1);
    expect(summary.details[0].discrepancyType).toBe('OMISION_SUNAT');
    expect(summary.details[0].localTotalAmount).toBe(118.0);
  });

  it('debería clasificar como OMISION_LOCAL cuando SUNAT reporta un comprobante no registrado localmente', () => {
    const sireProposal: SireRecord = {
      emitterRuc: '20200000001',
      documentType: '01',
      series: 'F002',
      correlative: '00000555',
      taxableBase: 500.0,
      igvAmount: 90.0,
      totalAmount: 590.0,
    };

    const summary = ReconciliationMatcherRule.reconcile([], [sireProposal]);

    expect(summary.exactMatchesCount).toBe(0);
    expect(summary.discrepanciesCount).toBe(1);
    expect(summary.details[0].discrepancyType).toBe('OMISION_LOCAL');
    expect(summary.details[0].sireTotalAmount).toBe(590.0);
  });

  it('debería construir la llave compuesta normalizando espacios y mayúsculas', () => {
    const summary = ReconciliationMatcherRule.reconcile(
      [{ ...localInvoice, series: ' f001 ' }],
      [{ ...localInvoice, series: 'F001' }],
    );

    expect(summary.exactMatchesCount).toBe(1);
    expect(summary.details[0].discrepancyType).toBe('COINCIDENCIA_EXACTA');
  });
});
