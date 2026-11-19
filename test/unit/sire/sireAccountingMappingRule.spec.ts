import {
  accountDisplayName,
  buildSireAccountingLines,
  roundSireAmount,
  sumSireRecordTotals,
} from '../../../src/modules/sire/domain/rules/sireAccountingMappingRule';
import type { SireAccountingMappingEntry } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';

const totals = { taxableBase: 100, igvAmount: 18, totalAmount: 118 };

describe('sireAccountingMappingRule', () => {
  it('redondea importes y descarta valores no numéricos', () => {
    expect(roundSireAmount(12.345)).toBe(12.35);
    expect(roundSireAmount('10.999')).toBe(11);
    expect(roundSireAmount('abc')).toBe(0);
    expect(roundSireAmount(Number.NaN)).toBe(0);
  });

  it('suma los importes de los comprobantes', () => {
    expect(
      sumSireRecordTotals([
        { taxableBase: 100, igvAmount: 18, totalAmount: 118 },
        { taxableBase: 50.555, igvAmount: 9.099, totalAmount: 59.654 },
      ]),
    ).toEqual({ taxableBase: 150.56, igvAmount: 27.1, totalAmount: 177.65 });
  });

  it('resuelve nombres de cuenta conocidos y deja un nombre genérico para el resto', () => {
    expect(accountDisplayName('701')).toBe('Ventas de mercaderías');
    expect(accountDisplayName('999')).toBe('Cuenta contable 999');
  });

  it('genera el asiento de ventas con las cuentas por defecto', () => {
    const lines = buildSireAccountingLines('VENTAS', totals, []);

    expect(lines).toEqual([
      { cuenta: '121', nombre: 'Cuentas por cobrar comerciales', debe: 118, haber: 0 },
      { cuenta: '701', nombre: 'Ventas de mercaderías', debe: 0, haber: 100 },
      { cuenta: '40111', nombre: 'IGV cuenta propia', debe: 0, haber: 18 },
    ]);
  });

  it('genera el asiento de compras con las cuentas por defecto', () => {
    const lines = buildSireAccountingLines('COMPRAS', totals, []);

    expect(lines).toEqual([
      { cuenta: '6011', nombre: 'Compras de mercaderías', debe: 100, haber: 0 },
      { cuenta: '40111', nombre: 'IGV cuenta propia', debe: 18, haber: 0 },
      { cuenta: '421', nombre: 'Cuentas por pagar comerciales', debe: 0, haber: 118 },
    ]);
  });

  it('usa el mapeo configurado, ignorando mayúsculas y espacios', () => {
    const mappings: SireAccountingMappingEntry[] = [
      { tipoOperacion: ' ventas ', cuentaContable: ' 131 ' },
      { tipoOperacion: 'base_ventas', cuentaContable: '702' },
      { tipoOperacion: 'igv', cuentaContable: '40112' },
    ];

    const lines = buildSireAccountingLines('VENTAS', totals, mappings);

    expect(lines.map((line) => line.cuenta)).toEqual(['131', '702', '40112']);
  });

  it('usa BASE como respaldo cuando no hay cuenta específica del libro', () => {
    const mappings: SireAccountingMappingEntry[] = [
      { tipoOperacion: 'BASE', cuentaContable: '703' },
    ];

    expect(
      buildSireAccountingLines('VENTAS', totals, mappings)[1].cuenta,
    ).toBe('703');
    expect(
      buildSireAccountingLines('COMPRAS', totals, mappings)[0].cuenta,
    ).toBe('703');
  });

  it('prioriza BASE_COMPRAS sobre BASE en compras', () => {
    const mappings: SireAccountingMappingEntry[] = [
      { tipoOperacion: 'BASE', cuentaContable: '703' },
      { tipoOperacion: 'BASE_COMPRAS', cuentaContable: '602' },
      { tipoOperacion: 'COMPRAS', cuentaContable: '422' },
    ];

    const lines = buildSireAccountingLines('COMPRAS', totals, mappings);

    expect(lines[0]).toMatchObject({ cuenta: '602', debe: 100 });
    expect(lines[2]).toMatchObject({ cuenta: '422', haber: 118 });
  });

  it('deriva el total desde base e IGV cuando el total viene en cero', () => {
    const lines = buildSireAccountingLines(
      'VENTAS',
      { taxableBase: 100, igvAmount: 18, totalAmount: 0 },
      [],
    );

    expect(lines[0]).toMatchObject({ cuenta: '121', debe: 118 });
  });

  it('omite las líneas en cero y devuelve un arreglo vacío sin importes', () => {
    expect(
      buildSireAccountingLines(
        'VENTAS',
        { taxableBase: 0, igvAmount: 0, totalAmount: 0 },
        [],
      ),
    ).toEqual([]);
    expect(
      buildSireAccountingLines(
        'COMPRAS',
        { taxableBase: -10, igvAmount: -2, totalAmount: -12 },
        [],
      ),
    ).toEqual([]);
  });

  it('ajusta la base cuando supera el total para mantener el cuadre', () => {
    const lines = buildSireAccountingLines(
      'VENTAS',
      { taxableBase: 200, igvAmount: 18, totalAmount: 100 },
      [],
    );

    expect(lines).toEqual([
      { cuenta: '121', nombre: 'Cuentas por cobrar comerciales', debe: 100, haber: 0 },
      { cuenta: '701', nombre: 'Ventas de mercaderías', debe: 0, haber: 100 },
    ]);
  });

  it('deja todo el importe en el IGV cuando no hay base', () => {
    const lines = buildSireAccountingLines(
      'COMPRAS',
      { taxableBase: 0, igvAmount: 18, totalAmount: 18 },
      [],
    );

    expect(lines).toEqual([
      { cuenta: '40111', nombre: 'IGV cuenta propia', debe: 18, haber: 0 },
      { cuenta: '421', nombre: 'Cuentas por pagar comerciales', debe: 0, haber: 18 },
    ]);
  });

  it('usa IGV_VENTAS e IGV_COMPRAS por libro y conserva IGV como alias legado', () => {
    const mappings: SireAccountingMappingEntry[] = [
      { tipoOperacion: 'IGV_VENTAS', cuentaContable: '40113' },
      { tipoOperacion: 'IGV_COMPRAS', cuentaContable: '40112' },
    ];

    expect(
      buildSireAccountingLines('VENTAS', totals, mappings).find((line) => line.cuenta.startsWith('401'))?.cuenta,
    ).toBe('40113');
    expect(
      buildSireAccountingLines('COMPRAS', totals, mappings).find((line) => line.cuenta.startsWith('401'))?.cuenta,
    ).toBe('40112');

    const legado: SireAccountingMappingEntry[] = [
      { tipoOperacion: 'IGV', cuentaContable: '40111' },
    ];
    expect(
      buildSireAccountingLines('VENTAS', totals, legado).find((line) => line.cuenta === '40111')?.haber,
    ).toBe(18);
    expect(
      buildSireAccountingLines('COMPRAS', totals, legado).find((line) => line.cuenta === '40111')?.debe,
    ).toBe(18);
  });
});
