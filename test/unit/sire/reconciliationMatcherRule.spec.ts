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
      taxableBase: 100.02,
      igvAmount: 18.01,
      totalAmount: 118.03,
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
      taxableBase: 120.0,
      igvAmount: 21.6,
      totalAmount: 141.6,
    };

    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [sireProposal],
    );

    expect(summary.exactMatchesCount).toBe(0);
    expect(summary.discrepanciesCount).toBe(1);
    expect(summary.details[0].discrepancyType).toBe('DIFERENCIA_MONTOS');
    expect(summary.details[0].amountDifference).toBe(23.6);
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
});
