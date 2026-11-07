import { FifoCostEngine } from '../../../src/modules/inventory/domain/rules/FifoCostEngine';

describe('FifoCostEngine', () => {
  it('agrega una capa en la entrada', () => {
    const r = FifoCostEngine.calculate({ layers: [], movementDirection: 'ENTRADA', quantity: 10, unitCost: 5 });
    expect(r.resultingStock).toBe(10);
    expect(r.resultingTotalValue).toBe(50);
  });

  it('consume la capa más antigua primero', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 5, unitCost: 10 }, { quantity: 5, unitCost: 20 }],
      movementDirection: 'SALIDA', quantity: 3,
    });
    expect(r.movementTotalCost).toBe(30);
    expect(r.layers).toEqual([{ quantity: 2, unitCost: 10 }, { quantity: 5, unitCost: 20 }]);
    expect(r.resultingStock).toBe(7);
  });

  it('atraviesa varias capas', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 5, unitCost: 10 }, { quantity: 5, unitCost: 20 }],
      movementDirection: 'SALIDA', quantity: 8,
    });
    expect(r.movementTotalCost).toBe(110);
    expect(r.resultingStock).toBe(2);
    expect(r.resultingTotalValue).toBe(40);
  });

  it('rechaza salida mayor al stock', () => {
    expect(() => FifoCostEngine.calculate({
      layers: [{ quantity: 2, unitCost: 10 }], movementDirection: 'SALIDA', quantity: 3,
    })).toThrow(/Stock insuficiente/);
  });

  it('liquida por completo sin centavos residuales', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 2, unitCost: 10 }, { quantity: 3, unitCost: 20 }],
      movementDirection: 'SALIDA', quantity: 5,
    });
    expect(r.resultingStock).toBe(0);
    expect(r.resultingTotalValue).toBe(0);
  });
});
