export interface ProrationItemInput {
  itemId: string;
  itemCode?: string;
  description?: string;
  commercialDescription?: string;
  quantity: number;
  fobUsd: number;
  cifPen: number;
  adValoremPen: number;
  weightKg?: number;
  netWeightKg?: number;
}

export interface LocalExpenseInput {
  expenseId?: string;
  concept?: string;
  expenseConcept?: string;
  supplierRuc?: string;
  invoiceNumber?: string;
  invoiceSerialNumber?: string;
  netAmountPen: number;
  igvAmountPen?: number;
  totalAmountPen?: number;
  isCapitalizable?: boolean;
  prorationMethod: 'VALOR_FOB' | 'PESO_BRUTO' | 'UNIDADES';
}

export interface ProratedItemResult {
  itemId: string;
  itemCode: string;
  quantity: number;
  fobUsd: number;
  cifPen: number;
  adValoremPen: number;
  allocatedValueExpensePen: number;
  allocatedWeightExpensePen: number;
  allocatedUnitsExpensePen: number;
  allocatedValueExpensesPen: number;
  allocatedWeightExpensesPen: number;
  allocatedUnitsExpensesPen: number;
  totalAllocatedLocalExpensesPen: number;
  totalInventoryCostPen: number;
  unitLandedCostPen: number;
}

export interface ProrationResult {
  totalFobUsd: number;
  totalCifPen: number;
  totalDutiesPen: number;
  totalLocalExpensesPen: number;
  totalInventoryCostPen: number;
  items: ProratedItemResult[];
}

export class ProrationEngine {
  public static execute(
    items: ProrationItemInput[],
    localExpenses: LocalExpenseInput[],
  ): ProrationResult {
    if (!items || items.length === 0) {
      throw new Error('Debe proporcionar al menos un ítem para calcular el Landed Cost.');
    }

    // 1. Totales de base para factores de asignación
    let totalFobUsd = 0;
    let totalWeightKg = 0;
    let totalQuantity = 0;
    let totalCifPen = 0;
    let totalDutiesPen = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad del ítem ${item.itemCode || item.itemId} debe ser mayor a cero.`);
      }
      totalFobUsd += item.fobUsd;
      totalWeightKg += item.weightKg ?? item.netWeightKg ?? 0;
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

    for (const expense of localExpenses) {
      if (expense.isCapitalizable === false) {
        continue; // Excluir gastos operativos o no capitalizables según NIC 2
      }

      const netAmount = expense.netAmountPen; // Solo base imponible, IGV se excluye (crédito fiscal)

      switch (expense.prorationMethod) {
        case 'PESO_BRUTO':
          totalExpensesByWeight += netAmount;
          break;
        case 'UNIDADES':
          totalExpensesByUnits += netAmount;
          break;
        case 'VALOR_FOB':
        default:
          totalExpensesByValue += netAmount;
          break;
      }
    }

    totalExpensesByValue = this.round(totalExpensesByValue, 2);
    totalExpensesByWeight = this.round(totalExpensesByWeight, 2);
    totalExpensesByUnits = this.round(totalExpensesByUnits, 2);
    const totalLocalExpensesPen = this.round(
      totalExpensesByValue + totalExpensesByWeight + totalExpensesByUnits,
      2,
    );

    // 3. Prorratear gastos a cada ítem según corresponda
    const proratedItems: ProratedItemResult[] = [];
    let sumAllocatedLocalExpenses = 0;
    let highestValueItemIndex = 0;
    let maxFobUsd = -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.fobUsd > maxFobUsd) {
        maxFobUsd = item.fobUsd;
        highestValueItemIndex = i;
      }

      const factorValue = totalFobUsd > 0 ? item.fobUsd / totalFobUsd : 0;
      const weight = item.weightKg ?? item.netWeightKg ?? 0;
      const factorWeight =
        totalWeightKg > 0 && weight > 0 ? weight / totalWeightKg : 0;
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
        itemCode: item.itemCode || item.itemId,
        quantity: item.quantity,
        fobUsd: item.fobUsd,
        cifPen: item.cifPen,
        adValoremPen: item.adValoremPen,
        allocatedValueExpensePen: allocatedVal,
        allocatedWeightExpensePen: allocatedWeight,
        allocatedUnitsExpensePen: allocatedUnits,
        allocatedValueExpensesPen: allocatedVal,
        allocatedWeightExpensesPen: allocatedWeight,
        allocatedUnitsExpensesPen: allocatedUnits,
        totalAllocatedLocalExpensesPen: itemAllocatedExpenses,
        totalInventoryCostPen: totalItemCost,
        unitLandedCostPen: unitLandedCost,
      });
    }

    // 4. Ajuste de centavos por redondeo (Garantía de cuadre contable exacto)
    const difference = this.round(totalLocalExpensesPen - sumAllocatedLocalExpenses, 2);
    if (Math.abs(difference) > 0 && proratedItems.length > 0) {
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
      totalCifPen,
      totalDutiesPen,
      totalLocalExpensesPen,
      totalInventoryCostPen,
      items: proratedItems,
    };
  }

  /**
   * Alias de compatibilidad para cálculo de Landed Cost
   */
  public static calculateLandedCost(
    items: ProrationItemInput[],
    localExpenses: LocalExpenseInput[],
  ): ProrationResult {
    return this.execute(items, localExpenses);
  }

  private static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
