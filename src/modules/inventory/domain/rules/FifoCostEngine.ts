export interface CostLayer {
  quantity: number;
  unitCost: number;
}

export interface FifoLayer {
  layerId?: string;
  quantity: number;
  remainingQuantity: number;
  unitCost: number;
  entryDate?: Date | string;
}

export interface FifoConsumptionDetail {
  layerId?: string;
  consumedQuantity: number;
  unitCost: number;
  subtotalCost: number;
}

export interface FifoInput {
  existingLayers?: FifoLayer[];
  layers?: readonly CostLayer[];
  movementDirection: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost?: number;
  layerId?: string;
  movementDate?: Date | string;
}

export interface FifoResult {
  movementQuantity: number;
  movementUnitCost: number;
  movementTotalCost: number;
  resultingStock: number;
  resultingTotalValue: number;
  resultingAverageCost: number;
  layers: CostLayer[];
  updatedLayers: FifoLayer[];
  consumptions?: FifoConsumptionDetail[];
}

const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Motor de valuación de inventarios por el método FIFO / PEPS
 * (Primeras Entradas, Primeras Salidas), según Art. 62 de la Ley del Impuesto a la Renta.
 */
export class FifoCostEngine {
  public static calculate(input: FifoInput): FifoResult {
    const qty = r4(input.quantity);
    if (qty <= 0) {
      throw new Error('La cantidad debe ser mayor que cero.');
    }

    const incoming: readonly (CostLayer | FifoLayer)[] = input.existingLayers ?? input.layers ?? [];
    const currentLayers: FifoLayer[] = incoming
      .map((l, idx): FifoLayer => {
        const remaining = 'remainingQuantity' in l && typeof (l as FifoLayer).remainingQuantity === 'number'
          ? (l as FifoLayer).remainingQuantity
          : l.quantity;
        const layerId = 'layerId' in l && typeof (l as FifoLayer).layerId === 'string' && (l as FifoLayer).layerId
          ? (l as FifoLayer).layerId
          : `layer-${idx + 1}`;
        const entryDate = 'entryDate' in l ? (l as FifoLayer).entryDate : undefined;

        return {
          layerId,
          quantity: r4(l.quantity),
          remainingQuantity: r4(remaining),
          unitCost: r4(l.unitCost),
          entryDate,
        };
      })
      .filter((l) => l.remainingQuantity > 0);

    const prevStock = r4(currentLayers.reduce((acc, l) => acc + l.remainingQuantity, 0));

    if (input.movementDirection === 'ENTRADA') {
      const unitCost = r4(input.unitCost ?? 0);
      if (unitCost < 0) {
        throw new Error('El costo de entrada no puede ser negativo.');
      }

      const movementTotalCost = r2(qty * unitCost);
      const newLayer: FifoLayer = {
        layerId: input.layerId || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        quantity: qty,
        remainingQuantity: qty,
        unitCost,
        entryDate: input.movementDate,
      };

      const updatedLayers = [...currentLayers, newLayer];
      const resultingStock = r4(prevStock + qty);
      const resultingTotalValue = r2(
        updatedLayers.reduce((acc, l) => acc + l.remainingQuantity * l.unitCost, 0),
      );
      const resultingAverageCost = resultingStock > 0 ? r4(resultingTotalValue / resultingStock) : 0;
      const layers: CostLayer[] = updatedLayers.map((l) => ({
        quantity: l.remainingQuantity,
        unitCost: l.unitCost,
      }));

      return {
        movementQuantity: qty,
        movementUnitCost: unitCost,
        movementTotalCost,
        resultingStock,
        resultingTotalValue,
        resultingAverageCost,
        layers,
        updatedLayers,
        consumptions: [],
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
        const subtotal = r2(consumed * layer.unitCost);
        movementTotalCost = r2(movementTotalCost + subtotal);
        pendingToConsume = r4(pendingToConsume - consumed);
        consumptions.push({
          layerId: layer.layerId,
          consumedQuantity: consumed,
          unitCost: layer.unitCost,
          subtotalCost: subtotal,
        });
        // La capa se agota completamente (remainingQuantity = 0)
      } else {
        const consumed = pendingToConsume;
        const subtotal = r2(consumed * layer.unitCost);
        movementTotalCost = r2(movementTotalCost + subtotal);
        consumptions.push({
          layerId: layer.layerId,
          consumedQuantity: consumed,
          unitCost: layer.unitCost,
          subtotalCost: subtotal,
        });
        updatedLayers.push({
          ...layer,
          remainingQuantity: r4(layer.remainingQuantity - consumed),
        });
        pendingToConsume = 0;
      }
    }

    const movementUnitCost = qty > 0 ? r4(movementTotalCost / qty) : 0;
    const resultingStock = r4(prevStock - qty);
    const resultingTotalValue = r2(
      updatedLayers.reduce((acc, l) => acc + l.remainingQuantity * l.unitCost, 0),
    );
    const resultingAverageCost = resultingStock > 0 ? r4(resultingTotalValue / resultingStock) : 0;
    const layers: CostLayer[] = updatedLayers.map((l) => ({
      quantity: l.remainingQuantity,
      unitCost: l.unitCost,
    }));

    return {
      movementQuantity: qty,
      movementUnitCost,
      movementTotalCost,
      resultingStock,
      resultingTotalValue,
      resultingAverageCost,
      layers,
      updatedLayers,
      consumptions,
    };
  }
}
