export interface ProrationItemInput {
  itemId: string;
  itemCode?: string;
  description: string;
  quantity: number;
  netWeightKg: number;
  fobUsd: number;
  cifPen: number;
  adValoremPen: number;
}

export interface LocalExpenseInput {
  expenseId?: string;
  concept: string; // 'AGENCIA', 'ALMACENAJE', 'TRANSPORTE_LOCAL', 'VISTO_BUENO'
  supplierRuc?: string;
  invoiceNumber?: string;
  netAmountPen: number; // Monto neto SIN IGV (NIC 2)
  prorationMethod: 'VALOR_FOB' | 'PESO_BRUTO' | 'UNIDADES';
  isCapitalizable?: boolean;
}

export interface ProratedItemResult {
  itemId: string;
  itemCode?: string;
  description: string;
  quantity: number;
  netWeightKg: number;
  fobUsd: number;
  cifPen: number;
  adValoremPen: number;
  allocatedValueExpensePen: number;
  allocatedWeightExpensePen: number;
  allocatedUnitExpensePen: number;
  totalAllocatedLocalExpensesPen: number;
  totalInventoryCostPen: number; // CIF + AdValorem + Gastos Locales
  unitLandedCostPen: number; // Costo Unitario Nacionalizado (4 decimales)
}

export interface ProrationResult {
  totalFobUsd: number;
  totalWeightKg: number;
  totalQuantity: number;
  totalCifPen: number;
  totalDutiesPen: number;
  totalLocalExpensesPen: number;
  totalInventoryCostPen: number; // Total a debitar a Cuenta 20111 (Inventarios)
  items: ProratedItemResult[];
}

export class ProrationEngine {
  /**
   * Ejecuta el prorrateo multivariable de costos de adquisición según la Norma Internacional de Contabilidad 2 (NIC 2)
   */
  public static calculateLandedCost(
    items: ProrationItemInput[],
    expenses: LocalExpenseInput[],
  ): ProrationResult {
    if (!items || items.length === 0) {
      throw new Error('Debe proporcionar al menos un ítem para calcular el Landed Cost.');
    }

    // 1. Totales base de los ítems
    let totalFobUsd = 0;
    let totalWeightKg = 0;
    let totalQuantity = 0;
    let totalCifPen = 0;
    let totalDutiesPen = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad del ítem '${item.description}' debe ser mayor a cero.`);
      }
      if (item.fobUsd <= 0) {
        throw new Error(`El valor FOB del ítem '${item.description}' debe ser mayor a cero.`);
      }
      totalFobUsd += item.fobUsd;
      totalWeightKg += item.netWeightKg > 0 ? item.netWeightKg : 1; // Fallback mínimo si no declaran peso
      totalQuantity += item.quantity;
      totalCifPen += item.cifPen;
      totalDutiesPen += item.adValoremPen;
    }

    totalFobUsd = this.round(totalFobUsd, 2);
    totalCifPen = this.round(totalCifPen, 2);
    totalDutiesPen = this.round(totalDutiesPen, 2);

    // 2. Clasificar gastos locales capitalizables por método de prorrateo
    let totalExpensesByValue = 0;
    let totalExpensesByWeight = 0;
    let totalExpensesByUnits = 0;

    for (const exp of expenses) {
      // Por defecto todo gasto directo de desaduanaje es capitalizable según NIC 2 párr. 11
      const isCapitalizable = exp.isCapitalizable ?? true;
      if (!isCapitalizable) continue;

      if (exp.netAmountPen < 0) {
        throw new Error(`El gasto '${exp.concept}' no puede tener un monto negativo.`);
      }

      if (exp.prorationMethod === 'PESO_BRUTO') {
        totalExpensesByWeight += exp.netAmountPen;
      } else if (exp.prorationMethod === 'UNIDADES') {
        totalExpensesByUnits += exp.netAmountPen;
      } else {
        // Por defecto: VALOR_FOB
        totalExpensesByValue += exp.netAmountPen;
      }
    }

    totalExpensesByValue = this.round(totalExpensesByValue, 2);
    totalExpensesByWeight = this.round(totalExpensesByWeight, 2);
    totalExpensesByUnits = this.round(totalExpensesByUnits, 2);
    const totalLocalExpensesPen = this.round(
      totalExpensesByValue + totalExpensesByWeight + totalExpensesByUnits,
      2,
    );

    // 3. Prorratear a cada ítem
    const proratedItems: ProratedItemResult[] = [];
    let sumAllocatedLocalExpenses = 0;
    let highestValueItemIndex = 0;
    let maxFob = -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.fobUsd > maxFob) {
        maxFob = item.fobUsd;
        highestValueItemIndex = i;
      }

      const weightUsed = item.netWeightKg > 0 ? item.netWeightKg : 1;
      const factorValue = totalFobUsd > 0 ? item.fobUsd / totalFobUsd : 0;
      const factorWeight = totalWeightKg > 0 ? weightUsed / totalWeightKg : 0;
      const factorUnits = totalQuantity > 0 ? item.quantity / totalQuantity : 0;

      const allocatedVal = this.round(totalExpensesByValue * factorValue, 2);
      const allocatedWeight = this.round(totalExpensesByWeight * factorWeight, 2);
      const allocatedUnits = this.round(totalExpensesByUnits * factorUnits, 2);
      const itemAllocatedExpenses = this.round(allocatedVal + allocatedWeight + allocatedUnits, 2);

      sumAllocatedLocalExpenses += itemAllocatedExpenses;

      const totalItemCost = this.round(item.cifPen + item.adValoremPen + itemAllocatedExpenses, 2);
      const unitLandedCost = this.round(totalItemCost / item.quantity, 4);

      proratedItems.push({
        itemId: item.itemId,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        netWeightKg: item.netWeightKg,
        fobUsd: item.fobUsd,
        cifPen: item.cifPen,
        adValoremPen: item.adValoremPen,
        allocatedValueExpensePen: allocatedVal,
        allocatedWeightExpensePen: allocatedWeight,
        allocatedUnitExpensePen: allocatedUnits,
        totalAllocatedLocalExpensesPen: itemAllocatedExpenses,
        totalInventoryCostPen: totalItemCost,
        unitLandedCostPen: unitLandedCost,
      });
    }

    // 4. Ajuste de centavos por redondeo (Garantía de cuadre contable exacto)
    const difference = this.round(totalLocalExpensesPen - sumAllocatedLocalExpenses, 2);
    if (Math.abs(difference) > 0 && Math.abs(difference) <= 0.05 && proratedItems.length > 0) {
      const target = proratedItems[highestValueItemIndex];
      target.totalAllocatedLocalExpensesPen = this.round(
        target.totalAllocatedLocalExpensesPen + difference,
        2,
      );
      target.totalInventoryCostPen = this.round(
        target.cifPen + target.adValoremPen + target.totalAllocatedLocalExpensesPen,
        2,
      );
      target.unitLandedCostPen = this.round(target.totalInventoryCostPen / target.quantity, 4);
    }

    const totalInventoryCostPen = this.round(
      totalCifPen + totalDutiesPen + totalLocalExpensesPen,
      2,
    );

    return {
      totalFobUsd,
      totalWeightKg,
      totalQuantity,
      totalCifPen,
      totalDutiesPen,
      totalLocalExpensesPen,
      totalInventoryCostPen,
      items: proratedItems,
    };
  }

  private static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
