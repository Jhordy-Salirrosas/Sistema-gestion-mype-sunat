import { ReconciliationMatcherRule } from '../../../src/modules/sire/domain/rules/reconciliationMatcherRule';
import { indexRecords } from '../../../src/modules/sire/domain/rules/reconciliationRecordUtils';
import type { SireRecord } from '../../../src/modules/sire/domain/entities/sireProposalEntity';
import {
  extraerPeriodoYLibroDelNombre,
  nombreBaseSinExtension,
  validarNombreArchivoSire,
} from '../../../src/modules/sire/domain/rules/sireFileNameRule';

jest.mock(
  '../../../src/modules/sire/domain/rules/reconciliationRecordUtils',
  () => {
    const actual = jest.requireActual<
      typeof import('../../../src/modules/sire/domain/rules/reconciliationRecordUtils')
    >('../../../src/modules/sire/domain/rules/reconciliationRecordUtils');

    return {
      __esModule: true,
      ...actual,
      indexRecords: jest.fn(actual.indexRecords),
    };
  },
);

const actualRecordUtils = jest.requireActual<
  typeof import('../../../src/modules/sire/domain/rules/reconciliationRecordUtils')
>('../../../src/modules/sire/domain/rules/reconciliationRecordUtils');

const indexRecordsMock = indexRecords as unknown as jest.Mock;

describe('ReconciliationMatcherRule branch coverage', () => {
  const localInvoice: SireRecord = {
    emitterRuc: '20100070970',
    documentType: '01',
    series: 'F001',
    correlative: '00000001',
    taxableBase: 100.0,
    igvAmount: 18.0,
    totalAmount: 118.0,
  };

  const otherInvoice: SireRecord = {
    emitterRuc: '20200000001',
    documentType: '01',
    series: 'F002',
    correlative: '00000555',
    taxableBase: 500.0,
    igvAmount: 90.0,
    totalAmount: 590.0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    indexRecordsMock.mockImplementation(actualRecordUtils.indexRecords);
  });

  it('reports AMBOS as the duplicate source when both sides repeat the same key', () => {
    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice, localInvoice],
      [localInvoice, localInvoice],
    );

    expect(summary.discrepanciesCount).toBe(1);
    expect(summary.details[0]).toMatchObject({
      discrepancyType: 'DUPLICADO_LLAVE',
      duplicateSource: 'AMBOS',
    });
    expect(summary.details[0].localTotalAmount).toBeUndefined();
    expect(summary.details[0].sireTotalAmount).toBeUndefined();
  });

  it('reports SIRE as the duplicate source and uses the SUNAT record as reference', () => {
    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [otherInvoice, otherInvoice],
    );

    const duplicado = summary.details.find(
      (detail) => detail.discrepancyType === 'DUPLICADO_LLAVE',
    );

    expect(duplicado).toMatchObject({
      duplicateSource: 'SIRE',
      emitterRuc: otherInvoice.emitterRuc,
      documentType: otherInvoice.documentType,
      series: otherInvoice.series,
      correlative: otherInvoice.correlative,
    });
    expect(duplicado?.localTotalAmount).toBeUndefined();
    expect(duplicado?.sireTotalAmount).toBeUndefined();
  });

  it('keeps the local amount when the key is duplicated only on the SUNAT side', () => {
    const summary = ReconciliationMatcherRule.reconcile(
      [localInvoice],
      [localInvoice, localInvoice],
    );

    expect(summary.details).toHaveLength(1);
    expect(summary.details[0]).toMatchObject({
      discrepancyType: 'DUPLICADO_LLAVE',
      duplicateSource: 'SIRE',
      localTotalAmount: localInvoice.totalAmount,
    });
    expect(summary.details[0].sireTotalAmount).toBeUndefined();
  });

  it('skips a key reported by neither side when the index returns empty matches', () => {
    const localRecords: SireRecord[] = [localInvoice];
    const sireRecords: SireRecord[] = [localInvoice];
    const vacio = new Map<string, SireRecord[]>([['VACIA', []]]);

    indexRecordsMock.mockImplementation((records: SireRecord[]) =>
      records === localRecords ? vacio : vacio,
    );

    const summary = ReconciliationMatcherRule.reconcile(localRecords, sireRecords);

    expect(summary.details).toEqual([]);
    expect(summary.exactMatchesCount).toBe(0);
    expect(summary.discrepanciesCount).toBe(0);
    expect(summary.totalLocal).toBe(1);
    expect(summary.totalSire).toBe(1);
  });

  it('reports a zero deviation percentage when the local total amount is zero', () => {
    const localSinTotal: SireRecord = {
      ...localInvoice,
      taxableBase: 0,
      igvAmount: 0,
      totalAmount: 0,
    };
    const sireConTotal: SireRecord = {
      ...localInvoice,
      taxableBase: 500.0,
      igvAmount: 90.0,
      totalAmount: 590.0,
    };

    const summary = ReconciliationMatcherRule.reconcile(
      [localSinTotal],
      [sireConTotal],
    );

    expect(summary.details[0].discrepancyType).toBe('DIFERENCIA_MONTOS');
    expect(summary.details[0].deviationPercentage).toBe(0);
    expect(summary.details[0].amountDifference).toBe(590.0);
  });
});

describe('sireFileNameRule branch coverage', () => {
  const ruc = '20601030013';

  it('keeps the whole name when it has no extension', () => {
    expect(nombreBaseSinExtension(`LE${ruc}-RCE-202401`)).toBe(
      `LE${ruc}-RCE-202401`,
    );
  });

  it('treats a missing file name as an empty name', () => {
    const resultado = validarNombreArchivoSire(
      undefined as unknown as string,
      ruc,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.error).toBe('NOMBRE_VACIO');
  });

  it('returns no period nor book when the file name is missing', () => {
    expect(
      extraerPeriodoYLibroDelNombre(undefined as unknown as string),
    ).toEqual({});
  });

  it('extracts the period from a file name written without separators', () => {
    expect(extraerPeriodoYLibroDelNombre(`LE${ruc}202401.zip`)).toEqual({
      periodo: '202401',
    });
  });
});
