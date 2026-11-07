export interface CostLayer {
  quantity: number;
  unitCost: number;
}

export interface FifoInput {
  layers: readonly CostLayer[];
  movementDirection: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost?: number;
}

export interface FifoResult {
  movementUnitCost: number;
  movementTotalCost: number;
  layers: CostLayer[];
  resultingStock: number;
  resultingTotalValue: number;
  resultingAverageCost: number;
}

const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Costeo FIFO puro: consume las capas más antiguas primero. */
export class FifoCostEngine {
  static calculate(input: FifoInput): FifoResult {
    const quantity = r4(input.quantity);
    if (quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.');

    const layers = input.layers.map((l) => ({ quantity: r4(l.quantity), unitCost: r4(l.unitCost) }));
    const stock = r4(layers.reduce((acc, l) => acc + l.quantity, 0));

    if (input.movementDirection === 'ENTRADA') {
      const unitCost = r4(input.unitCost ?? 0);
      if (unitCost < 0) throw new Error('El costo de entrada no puede ser negativo.');
      const next = [...layers, { quantity, unitCost }];
      return this.resultado(quantity, r2(quantity * unitCost), next);
    }

    if (quantity > stock) {
      throw new Error(`Stock insuficiente. Disponible: ${stock}, solicitado: ${quantity}.`);
    }

    let pendiente = quantity;
    let costo = 0;
    const restantes: CostLayer[] = [];
    for (const layer of layers) {
      if (pendiente <= 0) {
        restantes.push(layer);
        continue;
      }
      const consumido = Math.min(layer.quantity, pendiente);
      costo += consumido * layer.unitCost;
      pendiente = r4(pendiente - consumido);
      if (layer.quantity > consumido) {
        restantes.push({ quantity: r4(layer.quantity - consumido), unitCost: layer.unitCost });
      }
    }

    return {
      ...this.resultado(quantity, r2(costo), restantes),
      movementUnitCost: r4(costo / quantity),
    };
  }

  private static resultado(quantity: number, totalCost: number, layers: CostLayer[]): FifoResult {
    const stock = r4(layers.reduce((acc, l) => acc + l.quantity, 0));
    const valor = r2(layers.reduce((acc, l) => acc + l.quantity * l.unitCost, 0));
    return {
      movementUnitCost: r4(totalCost / quantity),
      movementTotalCost: totalCost,
      layers: layers.filter((l) => l.quantity > 0),
      resultingStock: stock,
      resultingTotalValue: valor,
      resultingAverageCost: stock > 0 ? r4(valor / stock) : 0,
    };
  }
}
