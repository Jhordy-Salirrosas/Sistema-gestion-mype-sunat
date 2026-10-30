import { MovingWeightedAverageEngine } from '../../../src/modules/inventory/domain/rules/MovingWeightedAverageEngine';

describe('MovingWeightedAverageEngine', () => {
  it('calcula correctamente la primera entrada de mercadería (Saldo Inicial / Compra)', () => {
    const result = MovingWeightedAverageEngine.calculate({
      previousStock: 0,
      previousAverageCost: 0,
      previousTotalValue: 0,
      movementDirection: 'ENTRADA',
      quantity: 10,
      unitCost: 100,
    });

    expect(result.movementQuantity).toBe(10);
    expect(result.movementUnitCost).toBe(100);
    expect(result.movementTotalCost).toBe(1000);
    expect(result.resultingStock).toBe(10);
    expect(result.resultingAverageCost).toBe(100);
    expect(result.resultingTotalValue).toBe(1000);
  });

  it('calcula ponderación móvil tras una segunda entrada a costo diferente', () => {
    // Estado previo: 10 unidades a 100 PEN = 1000 PEN
    // Entrada: 5 unidades a 160 PEN = 800 PEN
    // Nuevo saldo: 15 unidades = 1800 PEN -> Nuevo promedio = 1800 / 15 = 120 PEN
    const result = MovingWeightedAverageEngine.calculate({
      previousStock: 10,
      previousAverageCost: 100,
      previousTotalValue: 1000,
      movementDirection: 'ENTRADA',
      quantity: 5,
      unitCost: 160,
    });

    expect(result.resultingStock).toBe(15);
    expect(result.resultingTotalValue).toBe(1800);
    expect(result.resultingAverageCost).toBe(120);
  });

  it('calcula salida parcial valorizada al costo promedio vigente', () => {
    // Estado previo: 15 unidades a 120 PEN = 1800 PEN
    // Salida: 8 unidades por venta (costo salida = 8 * 120 = 960 PEN)
    // Saldo restante: 7 unidades = 840 PEN -> Promedio sigue siendo 120 PEN
    const result = MovingWeightedAverageEngine.calculate({
      previousStock: 15,
      previousAverageCost: 120,
      previousTotalValue: 1800,
      movementDirection: 'SALIDA',
      quantity: 8,
    });

    expect(result.movementQuantity).toBe(8);
    expect(result.movementUnitCost).toBe(120);
    expect(result.movementTotalCost).toBe(960);
    expect(result.resultingStock).toBe(7);
    expect(result.resultingTotalValue).toBe(840);
    expect(result.resultingAverageCost).toBe(120);
  });

  it('liquida totalmente existencias y valor monetario al agotar stock a cero', () => {
    // Estado previo: 7 unidades con saldo 840 PEN
    // Salida de las 7 unidades: debe dejar stock 0, valor 0 y promedio 0 exactos
    const result = MovingWeightedAverageEngine.calculate({
      previousStock: 7,
      previousAverageCost: 120,
      previousTotalValue: 840,
      movementDirection: 'SALIDA',
      quantity: 7,
    });

    expect(result.movementQuantity).toBe(7);
    expect(result.resultingStock).toBe(0);
    expect(result.resultingTotalValue).toBe(0);
    expect(result.resultingAverageCost).toBe(0);
  });

  it('arroja error ante intento de salida con stock insuficiente (prohibición de stock negativo)', () => {
    expect(() =>
      MovingWeightedAverageEngine.calculate({
        previousStock: 5,
        previousAverageCost: 50,
        previousTotalValue: 250,
        movementDirection: 'SALIDA',
        quantity: 10,
      }),
    ).toThrow(/Stock insuficiente/);
  });

  it('arroja error si la cantidad de movimiento es menor o igual a cero', () => {
    expect(() =>
      MovingWeightedAverageEngine.calculate({
        previousStock: 10,
        previousAverageCost: 50,
        previousTotalValue: 500,
        movementDirection: 'ENTRADA',
        quantity: 0,
        unitCost: 50,
      }),
    ).toThrow(/estrictamente positiva/);
  });
});

