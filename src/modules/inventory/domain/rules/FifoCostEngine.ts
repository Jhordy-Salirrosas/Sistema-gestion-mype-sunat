export interface FifoLayer {
  layerId: string;
  quantity: number;
  remainingQuantity: number;
  unitCost: number;
  entryDate?: Date | string;
}

export interface FifoInput {
  existingLayers: FifoLayer[];
  movementDirection: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost?: number;
  layerId?: string;
  movementDate?: Date | string;
}

export interface FifoConsumptionDetail {
  layerId: string;
  consumedQuantity: number;
  unitCost: number;
  subtotalCost: number;
}

export interface FifoResult {
  movementQuantity: number;
  movementUnitCost: number;
  movementTotalCost: number;
  resultingStock: number;
  resultingTotalValue: number;
  updatedLayers: FifoLayer[];
  consumptions?: FifoConsumptionDetail[];
}

/**
 * Motor de valuación de inventarios por el método FIFO / PEPS
 * (Primeras Entradas, Primeras Salidas), según Art. 62 de la Ley del Impuesto a la Renta.
 */
export class FifoCostEngine {
  public static calculate(input: FifoInput): FifoResult {
    const qty = this.round(input.quantity, 4);
    if (qty <= 0) {
      throw new Error('La cantidad de movimiento debe ser estrictamente positiva.');
    }

    const currentLayers: FifoLayer[] = input.existingLayers
      .map((l) => ({ ...l }))
      .filter((l) => l.remainingQuantity > 0);

    const prevStock = this.round(
      currentLayers.reduce((acc, l) => acc + l.remainingQuantity, 0),
      4,
    );

    if (input.movementDirection === 'ENTRADA') {
      const unitCost = this.round(input.unitCost ?? 0, 4);
      if (unitCost < 0) {
        throw new Error('El costo unitario de entrada no puede ser negativo.');
      }

      const movementTotalCost = this.round(qty * unitCost, 2);
      const newLayer: FifoLayer = {
        layerId: input.layerId || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        quantity: qty,
        remainingQuantity: qty,
        unitCost,
        entryDate: input.movementDate,
      };

      const updatedLayers = [...currentLayers, newLayer];
      const resultingStock = this.round(prevStock + qty, 4);
      const resultingTotalValue = this.round(
        updatedLayers.reduce((acc, l) => acc + l.remainingQuantity * l.unitCost, 0),
        2,
      );

      return {
        movementQuantity: qty,
        movementUnitCost: unitCost,
        movementTotalCost,
        resultingStock,
        resultingTotalValue,
        updatedLayers,
      };
    }

    // SALIDA
    if (qty > prevStock) {
      throw new Error(
        `Stock insuficiente para método FIFO. Existencia disponible: ${prevStock}, cantidad requerida: ${qty}.`,
      );
    }

    let pendingToConsume = qty;
    let movementTotalCost = 0;
    const consumptions: FifoConsumptionDetail[] = [];
    const updatedLayers: FifoLayer[] = [];

    for (const layer of currentLayers) {
      if (pendingToConsume <= 0) {
        updatedLayers.push(layer);
        continue;
      }

      if (layer.remainingQuantity <= pendingToConsume) {
        const consumed = layer.remainingQuantity;
        const subtotal = this.round(consumed * layer.unitCost, 2);
        movementTotalCost = this.round(movementTotalCost + subtotal, 2);
        pendingToConsume = this.round(pendingToConsume - consumed, 4);
        consumptions.push({
          layerId: layer.layerId,
          consumedQuantity: consumed,
          unitCost: layer.unitCost,
          subtotalCost: subtotal,
        });
        // La capa se agota completamente (remainingQuantity = 0)
      } else {
        const consumed = pendingToConsume;
        const subtotal = this.round(consumed * layer.unitCost, 2);
        movementTotalCost = this.round(movementTotalCost + subtotal, 2);
        consumptions.push({
          layerId: layer.layerId,
          consumedQuantity: consumed,
          unitCost: layer.unitCost,
          subtotalCost: subtotal,
        });
        updatedLayers.push({
          ...layer,
          remainingQuantity: this.round(layer.remainingQuantity - consumed, 4),
        });
        pendingToConsume = 0;
      }
    }

    const movementUnitCost = qty > 0 ? this.round(movementTotalCost / qty, 4) : 0;
    const resultingStock = this.round(prevStock - qty, 4);
    const resultingTotalValue = this.round(
      updatedLayers.reduce((acc, l) => acc + l.remainingQuantity * l.unitCost, 0),
      2,
    );

    return {
      movementQuantity: qty,
      movementUnitCost,
      movementTotalCost,
      resultingStock,
      resultingTotalValue,
      updatedLayers,
      consumptions,
    };
  }

  private static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}

