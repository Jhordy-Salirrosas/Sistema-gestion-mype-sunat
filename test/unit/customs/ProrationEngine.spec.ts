import { ProrationEngine } from '../../../src/modules/customs/domain/rules/ProrationEngine';

describe('ProrationEngine (NIC 2 — Landed Cost Domain Rule)', () => {
  describe('Caso de Estudio Real: 100 Laptops Gamer de Juan', () => {
    it('debe prorratear los gastos locales y calcular el costo unitario nacionalizado exacto de S/ 2,120.75', () => {
      const items = [
        {
          itemId: 'item-laptop-01',
          itemCode: 'LAP-GAMER-001',
          description: 'Laptop Gamer 16GB Core i7 RTX 4060',
          quantity: 100,
          netWeightKg: 250.0,
          fobUsd: 50000.0,
          cifPen: 204375.0,
          adValoremPen: 0.0,
        },
      ];

      // Gastos locales de desaduanaje (Montos netos SIN IGV conforme a la NIC 2)
      const expenses = [
        {
          concept: 'ALMACENAJE_PORTUARIO',
          netAmountPen: 2800.0,
          prorationMethod: 'PESO_BRUTO' as const,
        },
        {
          concept: 'VISTO_BUENO_NAVIERA',
          netAmountPen: 1200.0,
          prorationMethod: 'VALOR_FOB' as const,
        },
        {
          concept: 'TRANSPORTE_LOCAL_CALLAO',
          netAmountPen: 1500.0,
          prorationMethod: 'PESO_BRUTO' as const,
        },
        {
          concept: 'AGENCIA_DE_ADUANA',
          netAmountPen: 2200.0,
          prorationMethod: 'VALOR_FOB' as const,
        },
      ];

      const result = ProrationEngine.calculateLandedCost(items, expenses);

      // 1. Verificación de Totales
      expect(result.totalFobUsd).toBe(50000.0);
      expect(result.totalCifPen).toBe(204375.0);
      expect(result.totalDutiesPen).toBe(0.0);
      expect(result.totalLocalExpensesPen).toBe(7700.0);
      expect(result.totalInventoryCostPen).toBe(212075.0); // 204375 + 7700

      // 2. Verificación del Ítem
      expect(result.items).toHaveLength(1);
      const laptop = result.items[0];

      expect(laptop.totalAllocatedLocalExpensesPen).toBe(7700.0);
      expect(laptop.totalInventoryCostPen).toBe(212075.0);
      expect(laptop.unitLandedCostPen).toBe(2120.75); // S/ 2,120.75 por laptop
    });
  });

  describe('Prorrateo Bivariado Multivariable (Peso vs Valor FOB)', () => {
    it('debe asignar el flete por peso y la comisión por valor entre productos heterogéneos', () => {
      const items = [
        {
          itemId: 'item-gpu',
          description: 'Tarjetas de Video de Alta Gama (Alto valor, bajo peso)',
          quantity: 50,
          netWeightKg: 50.0, // 50 kg (10% del peso total)
          fobUsd: 30000.0, // $30,000 (75% del valor FOB total)
          cifPen: 120000.0,
          adValoremPen: 0.0,
        },
        {
          itemId: 'item-fuente',
          description: 'Fuentes de Poder 850W (Bajo valor, alto peso)',
          quantity: 200,
          netWeightKg: 450.0, // 450 kg (90% del peso total)
          fobUsd: 10000.0, // $10,000 (25% del valor FOB total)
          cifPen: 40000.0,
          adValoremPen: 0.0,
        },
      ];

      const expenses = [
        {
          concept: 'COMISION_AGENTE',
          netAmountPen: 4000.0,
          prorationMethod: 'VALOR_FOB' as const, // Prorrateo por Valor (75% a GPUs, 25% a Fuentes)
        },
        {
          concept: 'FLETE_CAMION_PESADO',
          netAmountPen: 5000.0,
          prorationMethod: 'PESO_BRUTO' as const, // Prorrateo por Peso (10% a GPUs, 90% a Fuentes)
        },
      ];

      const result = ProrationEngine.calculateLandedCost(items, expenses);

      const gpu = result.items.find((i) => i.itemId === 'item-gpu')!;
      const fuente = result.items.find((i) => i.itemId === 'item-fuente')!;

      // Comisión (S/ 4,000): GPU 75% = S/ 3,000 | Fuente 25% = S/ 1,000
      expect(gpu.allocatedValueExpensePen).toBe(3000.0);
      expect(fuente.allocatedValueExpensePen).toBe(1000.0);

      // Flete (S/ 5,000): GPU 10% = S/ 500 | Fuente 90% = S/ 4,500
      expect(gpu.allocatedWeightExpensePen).toBe(500.0);
      expect(fuente.allocatedWeightExpensePen).toBe(4500.0);

      // Total de gastos asignados
      expect(gpu.totalAllocatedLocalExpensesPen).toBe(3500.0);
      expect(fuente.totalAllocatedLocalExpensesPen).toBe(5500.0);

      // Cuadre contable exacto al centavo
      const totalAsignado = gpu.totalAllocatedLocalExpensesPen + fuente.totalAllocatedLocalExpensesPen;
      expect(totalAsignado).toBe(9000.0);
    });
  });

  describe('Aislamiento de Gastos No Capitalizables (NIC 2)', () => {
    it('debe ignorar gastos no capitalizables como multas o sobrestadía imputable a negligencia', () => {
      const items = [
        {
          itemId: 'item-01',
          description: 'Mercadería General',
          quantity: 10,
          netWeightKg: 100.0,
          fobUsd: 5000.0,
          cifPen: 19000.0,
          adValoremPen: 1140.0,
        },
      ];

      const expenses = [
        {
          concept: 'TRANSPORTE',
          netAmountPen: 1000.0,
          prorationMethod: 'VALOR_FOB' as const,
          isCapitalizable: true,
        },
        {
          concept: 'SOBRESTADIA_NEGLIGENCIA',
          netAmountPen: 2500.0,
          prorationMethod: 'VALOR_FOB' as const,
          isCapitalizable: false, // NIC 2: Gasto del período (Cuenta 659), no costo de inventario
        },
      ];

      const result = ProrationEngine.calculateLandedCost(items, expenses);

      // Solo debe capitalizarse los S/ 1,000 del transporte
      expect(result.totalLocalExpensesPen).toBe(1000.0);
      expect(result.items[0].totalAllocatedLocalExpensesPen).toBe(1000.0);
      expect(result.totalInventoryCostPen).toBe(19000.0 + 1140.0 + 1000.0);
    });
  });

  describe('Validaciones de Dominio', () => {
    it('debe arrojar error si la lista de ítems está vacía', () => {
      expect(() => ProrationEngine.calculateLandedCost([], [])).toThrow(
        'Debe proporcionar al menos un ítem para calcular el Landed Cost.',
      );
    });

    it('debe arrojar error si algún ítem tiene cantidad cero o negativa', () => {
      expect(() =>
        ProrationEngine.calculateLandedCost(
          [
            {
              itemId: '1',
              description: 'Prueba',
              quantity: 0,
              netWeightKg: 10,
              fobUsd: 100,
              cifPen: 380,
              adValoremPen: 0,
            },
          ],
          [],
        ),
      ).toThrow(/debe ser mayor a cero/);
    });
  });
});
