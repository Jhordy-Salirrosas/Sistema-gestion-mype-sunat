import { FifoCostEngine, FifoLayer } from '../../../src/modules/inventory/domain/rules/FifoCostEngine';

describe('FifoCostEngine (PEPS / Primeras Entradas, Primeras Salidas)', () => {
  it('agrega capas correctamente en entradas sucesivas', () => {
    const input1 = {
      existingLayers: [],
      movementDirection: 'ENTRADA' as const,
      quantity: 10,
      unitCost: 20.0,
      layerId: 'layer-1',
    };

    const res1 = FifoCostEngine.calculate(input1);
    expect(res1.resultingStock).toBe(10);
    expect(res1.resultingTotalValue).toBe(200.0);
    expect(res1.updatedLayers).toHaveLength(1);

    const input2 = {
      existingLayers: res1.updatedLayers,
      movementDirection: 'ENTRADA' as const,
      quantity: 5,
      unitCost: 25.0,
      layerId: 'layer-2',
    };

    const res2 = FifoCostEngine.calculate(input2);
    expect(res2.resultingStock).toBe(15);
    expect(res2.resultingTotalValue).toBe(325.0); // 10*20 + 5*25 = 200 + 125 = 325
    expect(res2.updatedLayers).toHaveLength(2);
  });

  it('consume primero la capa más antigua en una salida parcial', () => {
    const layers: FifoLayer[] = [
      { layerId: 'layer-1', quantity: 10, remainingQuantity: 10, unitCost: 20.0 },
      { layerId: 'layer-2', quantity: 10, remainingQuantity: 10, unitCost: 30.0 },
    ];

    const res = FifoCostEngine.calculate({
      existingLayers: layers,
      movementDirection: 'SALIDA',
      quantity: 5,
    });

    expect(res.movementQuantity).toBe(5);
    expect(res.movementUnitCost).toBe(20.0);
    expect(res.movementTotalCost).toBe(100.0);
    expect(res.resultingStock).toBe(15);
    expect(res.resultingTotalValue).toBe(400.0); // 5*20 + 10*30 = 100 + 300 = 400
    expect(res.updatedLayers[0].remainingQuantity).toBe(5);
    expect(res.updatedLayers[1].remainingQuantity).toBe(10);
  });

  it('consume múltiples capas en orden FIFO cuando la salida supera la primera capa', () => {
    const layers: FifoLayer[] = [
      { layerId: 'layer-1', quantity: 10, remainingQuantity: 10, unitCost: 20.0 }, // 10 @ 20 = 200
      { layerId: 'layer-2', quantity: 10, remainingQuantity: 10, unitCost: 30.0 }, // 10 @ 30 = 300
    ];

    const res = FifoCostEngine.calculate({
      existingLayers: layers,
      movementDirection: 'SALIDA',
      quantity: 14,
    });

    // Debe consumir 10 de layer-1 (200) y 4 de layer-2 (120) = 320
    expect(res.movementQuantity).toBe(14);
    expect(res.movementTotalCost).toBe(320.0);
    expect(res.movementUnitCost).toBeCloseTo(320 / 14, 4);
    expect(res.resultingStock).toBe(6);
    expect(res.resultingTotalValue).toBe(180.0); // 6 @ 30 = 180
    expect(res.updatedLayers).toHaveLength(1); // layer-1 se agotó
    expect(res.updatedLayers[0].remainingQuantity).toBe(6);
    expect(res.consumptions).toHaveLength(2);
    expect(res.consumptions![0].consumedQuantity).toBe(10);
    expect(res.consumptions![1].consumedQuantity).toBe(4);
  });

  it('rechaza salidas que superen el stock total', () => {
    const layers: FifoLayer[] = [
      { layerId: 'layer-1', quantity: 5, remainingQuantity: 5, unitCost: 15.0 },
    ];

    expect(() =>
      FifoCostEngine.calculate({
        existingLayers: layers,
        movementDirection: 'SALIDA',
        quantity: 10,
      }),
    ).toThrow('Stock insuficiente para método FIFO');
  });
});

describe('FifoCostEngine (compatibilidad CostLayer)', () => {
  it('agrega una capa en la entrada', () => {
    const r = FifoCostEngine.calculate({ layers: [], movementDirection: 'ENTRADA', quantity: 10, unitCost: 5 });
    expect(r.resultingStock).toBe(10);
    expect(r.resultingTotalValue).toBe(50);
  });

  it('consume la capa más antigua primero', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 5, unitCost: 10 }, { quantity: 5, unitCost: 20 }],
      movementDirection: 'SALIDA',
      quantity: 3,
    });
    expect(r.movementTotalCost).toBe(30);
    expect(r.layers).toEqual([{ quantity: 2, unitCost: 10 }, { quantity: 5, unitCost: 20 }]);
    expect(r.resultingStock).toBe(7);
  });

  it('atraviesa varias capas', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 5, unitCost: 10 }, { quantity: 5, unitCost: 20 }],
      movementDirection: 'SALIDA',
      quantity: 8,
    });
    expect(r.movementTotalCost).toBe(110);
    expect(r.resultingStock).toBe(2);
    expect(r.resultingTotalValue).toBe(40);
  });

  it('rechaza salida mayor al stock', () => {
    expect(() =>
      FifoCostEngine.calculate({
        layers: [{ quantity: 2, unitCost: 10 }],
        movementDirection: 'SALIDA',
        quantity: 3,
      }),
    ).toThrow(/Stock insuficiente/);
  });

  it('liquida por completo sin centavos residuales', () => {
    const r = FifoCostEngine.calculate({
      layers: [{ quantity: 2, unitCost: 10 }, { quantity: 3, unitCost: 20 }],
      movementDirection: 'SALIDA',
      quantity: 5,
    });
    expect(r.resultingStock).toBe(0);
    expect(r.resultingTotalValue).toBe(0);
  });
});
