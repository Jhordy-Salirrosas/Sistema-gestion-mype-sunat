import { describe, it, expect } from 'vitest';
import { round2, round4 } from '@/modules/customs/lib/customsCalculations';

interface KardexState {
  stock_quantity: number;
  total_inventory_value: number;
  average_unit_cost: number;
}

interface DUAImportMovement {
  document_type: '50'; // SUNAT Tabla 10: 50 = DUA / DAM
  operation_type: '02'; // SUNAT Tabla 12: 02 = Compra / Importación
  document_number: string;
  quantity: number;
  total_landed_cost_pen: number;
}

/**
 * Aplica el asiento de importación nacionalizada según NIC 2 y SUNAT Formato 13.1.
 */
function applyDuaImportToKardex(
  previousState: KardexState,
  movement: DUAImportMovement
): KardexState {
  const newStock = previousState.stock_quantity + movement.quantity;
  const newTotalValue = round2(
    previousState.total_inventory_value + movement.total_landed_cost_pen
  );
  const newAverageCost = newStock > 0 ? round4(newTotalValue / newStock) : 0;

  return {
    stock_quantity: newStock,
    total_inventory_value: newTotalValue,
    average_unit_cost: newAverageCost,
  };
}

describe('Kardex PLE 13.1 — Motor de Costeo Promedio Ponderado Móvil y Sustento Tipo 50 DUA', () => {
  it('debe calcular el nuevo costo unitario promedio ponderado tras la nacionalización', () => {
    // Escenario: La MYPE tenía en almacén 20 laptops a un costo de S/ 2,000 c/u (Total: S/ 40,000)
    const initialKardex: KardexState = {
      stock_quantity: 20,
      total_inventory_value: 40000.0,
      average_unit_cost: 2000.0,
    };

    // Ingresa la DUA 118-2026-10-004200: 100 laptops a Landed Cost total de S/ 207,892.50
    const duaMovement: DUAImportMovement = {
      document_type: '50',
      operation_type: '02',
      document_number: '118-2026-10-004200',
      quantity: 100,
      total_landed_cost_pen: 207892.5,
    };

    const finalKardex = applyDuaImportToKardex(initialKardex, duaMovement);

    // 1. Stock final: 20 + 100 = 120 unidades
    expect(finalKardex.stock_quantity).toBe(120);

    // 2. Valor total en libros: 40,000 + 207,892.50 = 247,892.50 PEN
    expect(finalKardex.total_inventory_value).toBe(247892.5);

    // 3. Nuevo costo promedio ponderado: 247,892.50 / 120 = 2,065.7708 PEN
    expect(finalKardex.average_unit_cost).toBe(2065.7708);
  });

  it('debe registrar correctamente el ingreso cuando el saldo inicial de existencias es cero', () => {
    const emptyKardex: KardexState = {
      stock_quantity: 0,
      total_inventory_value: 0,
      average_unit_cost: 0,
    };

    const firstImport: DUAImportMovement = {
      document_type: '50',
      operation_type: '02',
      document_number: '118-2026-10-004200',
      quantity: 50,
      total_landed_cost_pen: 100000.0,
    };

    const result = applyDuaImportToKardex(emptyKardex, firstImport);

    expect(result.stock_quantity).toBe(50);
    expect(result.total_inventory_value).toBe(100000.0);
    expect(result.average_unit_cost).toBe(2000.0);
  });

  it('debe formatear defensivamente valores numéricos nulos o indefinidos sin arrojar errores en tiempo de ejecución', () => {
    const formatMoney = (val: number | undefined | null) =>
      `S/ ${Number(val ?? 0).toFixed(2)}`;

    const formatStock = (val: number | undefined | null) =>
      Number(val ?? 0).toLocaleString('es-PE');

    expect(formatMoney(undefined)).toBe('S/ 0.00');
    expect(formatMoney(null)).toBe('S/ 0.00');
    expect(formatMoney(1500.5)).toBe('S/ 1500.50');

    expect(formatStock(undefined)).toBe('0');
    expect(formatStock(null)).toBe('0');
    expect(formatStock(1000)).toMatch(/1[,.]000/);
  });
});
