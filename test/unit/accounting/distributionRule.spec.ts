import {
  cuentasFaltantes,
  DistributionError,
  repartir,
} from '../../../src/modules/accounting/domain/rules/distributionRule';

describe('distributionRule.repartir', () => {
  it('reparte por importes y calcula el porcentaje', () => {
    const r = repartir(100, [
      { accountCode: '63111', amount: 60 },
      { accountCode: '63421', amount: 40 },
    ]);
    expect(r).toEqual([
      { accountCode: '63111', amount: 60, percentage: 60 },
      { accountCode: '63421', amount: 40, percentage: 40 },
    ]);
  });

  it('reparte por porcentajes y calcula el importe', () => {
    const r = repartir(250, [
      { accountCode: '63111', percentage: 40 },
      { accountCode: '63421', percentage: 60 },
    ]);
    expect(r).toEqual([
      { accountCode: '63111', amount: 100, percentage: 40 },
      { accountCode: '63421', amount: 150, percentage: 60 },
    ]);
  });

  it('ajusta el céntimo del redondeo en la última línea', () => {
    const r = repartir(100, [
      { accountCode: 'A', percentage: 33.33 },
      { accountCode: 'B', percentage: 33.33 },
      { accountCode: 'C', percentage: 33.34 },
    ]);
    const total = r.reduce((s, l) => s + l.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(100);
    expect(r[2].amount).toBe(33.34);
  });

  it('rechaza una distribución vacía', () => {
    expect(() => repartir(100, [])).toThrow(DistributionError);
    expect(() => repartir(100, [])).toThrow('no puede estar vacía');
  });

  it('rechaza un total no positivo', () => {
    expect(() => repartir(0, [{ accountCode: 'A', amount: 1 }])).toThrow('mayor que cero');
  });

  it('rechaza importes que no suman el total', () => {
    expect(() =>
      repartir(100, [
        { accountCode: 'A', amount: 60 },
        { accountCode: 'B', amount: 30 },
      ]),
    ).toThrow('La distribución suma 90.00 y el total es 100.00');
  });

  it('rechaza porcentajes que no suman 100', () => {
    expect(() =>
      repartir(100, [
        { accountCode: 'A', percentage: 50 },
        { accountCode: 'B', percentage: 40 },
      ]),
    ).toThrow('deben sumar 100%');
  });

  it('rechaza mezclar importes con porcentajes', () => {
    expect(() =>
      repartir(100, [
        { accountCode: 'A', amount: 50 },
        { accountCode: 'B', percentage: 50 },
      ]),
    ).toThrow('no mezcle ambos criterios');
  });

  it('rechaza líneas sin importe ni porcentaje', () => {
    expect(() => repartir(100, [{ accountCode: 'A' }])).toThrow(
      'Indique el importe o el porcentaje',
    );
  });

  it('rechaza cuentas repetidas', () => {
    expect(() =>
      repartir(100, [
        { accountCode: '63111', amount: 50 },
        { accountCode: '63111', amount: 50 },
      ]),
    ).toThrow('está repetida');
  });

  it('rechaza una línea sin cuenta', () => {
    expect(() => repartir(100, [{ accountCode: '  ', amount: 100 }])).toThrow(
      'necesita una cuenta contable',
    );
  });

  it('rechaza importes cero o negativos', () => {
    expect(() =>
      repartir(100, [
        { accountCode: 'A', amount: 0 },
        { accountCode: 'B', amount: 100 },
      ]),
    ).toThrow('importe mayor que cero');
    expect(() => repartir(100, [{ accountCode: 'A', amount: -100 }, { accountCode: 'B', amount: 200 }])).toThrow(
      'importe mayor que cero',
    );
  });

  it('acepta una distribución de una sola cuenta', () => {
    expect(repartir(118, [{ accountCode: '63111', amount: 118 }])).toHaveLength(1);
  });

  it('tolera un céntimo de diferencia por redondeo', () => {
    const r = repartir(100, [
      { accountCode: 'A', amount: 33.33 },
      { accountCode: 'B', amount: 33.33 },
      { accountCode: 'C', amount: 33.33 },
    ]);
    expect(r.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(100, 2);
  });

  describe('cuentasFaltantes', () => {
    it('lista las cuentas que no están en el catálogo', () => {
      const faltantes = cuentasFaltantes(
        [
          { accountCode: '63111', amount: 1, percentage: 100 },
          { accountCode: '99999', amount: 1, percentage: 100 },
        ],
        [{ code: '63111', name: 'Servicios' }],
      );
      expect(faltantes).toEqual(['99999']);
    });
  });
});
