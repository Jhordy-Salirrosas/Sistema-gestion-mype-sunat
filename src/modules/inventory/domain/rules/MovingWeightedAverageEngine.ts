export interface MovingAverageInput {
  previousStock: number;
  previousAverageCost: number;
  previousTotalValue: number;
  movementDirection: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost?: number;
}

export interface MovingAverageResult {
  movementQuantity: number;
  movementUnitCost: number;
  movementTotalCost: number;
  resultingStock: number;
  resultingAverageCost: number;
  resultingTotalValue: number;
}

export class MovingWeightedAverageEngine {
  public static calculate(input: MovingAverageInput): MovingAverageResult {
    const prevStock = this.round(input.previousStock, 4);
    const prevTotalVal = this.round(input.previousTotalValue, 2);
    const prevAvgCost = this.round(input.previousAverageCost, 4);
    const qty = this.round(input.quantity, 4);

    if (qty <= 0) {
      throw new Error('La cantidad de movimiento debe ser estrictamente positiva.');
    }

    if (input.movementDirection === 'ENTRADA') {
      const unitCost = this.round(input.unitCost ?? 0, 4);
      if (unitCost < 0) {
        throw new Error('El costo unitario de entrada no puede ser negativo.');
      }

      const movementTotalCost = this.round(qty * unitCost, 2);
      const resultingStock = this.round(prevStock + qty, 4);
      const resultingTotalValue = this.round(prevTotalVal + movementTotalCost, 2);
      const resultingAverageCost =
        resultingStock > 0 ? this.round(resultingTotalValue / resultingStock, 4) : 0;

      return {
        movementQuantity: qty,
        movementUnitCost: unitCost,
        movementTotalCost,
        resultingStock,
        resultingAverageCost,
        resultingTotalValue,
      };
    }

    // SALIDA
    if (qty > prevStock) {
      throw new Error(
        `Stock insuficiente en almacén. Existencia disponible: ${prevStock}, cantidad requerida: ${qty}.`,
      );
    }

    // Liquidación total cuando se agota el inventario (evita centavos residuales)
    if (qty === prevStock) {
      const movementTotalCost = prevTotalVal;
      const movementUnitCost = qty > 0 ? this.round(movementTotalCost / qty, 4) : 0;

      return {
        movementQuantity: qty,
        movementUnitCost,
        movementTotalCost,
        resultingStock: 0,
        resultingAverageCost: 0,
        resultingTotalValue: 0,
      };
    }

    // Salida parcial
    const movementUnitCost = prevAvgCost;
    const movementTotalCost = this.round(qty * movementUnitCost, 2);
    const resultingStock = this.round(prevStock - qty, 4);
    const resultingTotalValue = this.round(prevTotalVal - movementTotalCost, 2);
    const resultingAverageCost =
      resultingStock > 0 ? this.round(resultingTotalValue / resultingStock, 4) : 0;

    return {
      movementQuantity: qty,
      movementUnitCost,
      movementTotalCost,
      resultingStock,
      resultingAverageCost,
      resultingTotalValue,
    };
  }

  private static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}

