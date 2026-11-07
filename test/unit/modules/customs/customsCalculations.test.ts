import { describe, it, expect } from 'vitest';
import {
  calculateCustomsTaxes,
  calculateItemProrating,
} from '@/modules/customs/lib/customsCalculations';
import { type CustomsItem } from '@/modules/customs/types/customs.types';

describe('customsCalculations — Motor Matemático y NIC 2', () => {
  describe('calculateCustomsTaxes', () => {
    it('debe liquidar con precisión milimétrica el Caso Oficial SUNAT ($10,000 FOB)', () => {
      const payload = {
        fob_value_usd: 10000,
        freight_value_usd: 1500,
        insurance_value_usd: 500,
        exchange_rate: 3.8,
        ad_valorem_rate: 6,
        perception_rate: 3.5,
      };

      const result = calculateCustomsTaxes(payload);

      // 1. CIF en USD y PEN
      expect(result.cif_value_usd).toBe(12000.0);
      expect(result.cif_value_pen).toBe(45600.0);

      // 2. Arancel Ad-Valorem (6% de CIF PEN)
      expect(result.ad_valorem_amount_pen).toBe(2736.0);

      // 3. IGV + IPM (18% de Base Imponible)
      expect(result.igv_ipm_amount_pen).toBe(8700.48);

      // 4. Percepción del IGV (3.5% de CIF PEN + Tributos)
      expect(result.perception_amount_pen).toBe(1996.28);

      // 5. Total de Deuda Tributaria SUNAT (Casilla 4)
      expect(result.total_customs_taxes_pen).toBe(13432.76);

      // 6. Criterio Contable NIC 2: Costo a Kardex vs Crédito Fiscal
      expect(result.landed_cost_total_pen).toBe(48336.0);
      expect(result.fiscal_credit_pen).toBe(10696.76);
    });

    it('debe liquidar arancel cero (0%) para importaciones bajo Tratado de Libre Comercio (TLC)', () => {
      const payload = {
        fob_value_usd: 5000,
        freight_value_usd: 500,
        insurance_value_usd: 100,
        exchange_rate: 3.8,
        ad_valorem_rate: 0,
        perception_rate: 3.5,
      };

      const result = calculateCustomsTaxes(payload);

      expect(result.cif_value_usd).toBe(5600.0);
      expect(result.cif_value_pen).toBe(21280.0);
      expect(result.ad_valorem_amount_pen).toBe(0.0);
      expect(result.landed_cost_total_pen).toBe(21280.0);
    });

    it('debe manejar entradas vacías o valores en cero sin generar NaN ni divisiones inválidas', () => {
      const result = calculateCustomsTaxes({});

      expect(result.cif_value_usd).toBe(0);
      expect(result.cif_value_pen).toBe(0);
      expect(result.total_customs_taxes_pen).toBe(0);
      expect(result.landed_cost_total_pen).toBe(0);
      expect(Number.isNaN(result.total_customs_taxes_pen)).toBe(false);
    });
  });

  describe('calculateItemProrating — Costeo Landed Cost por Serie', () => {
    it('debe prorratear equitativamente el CIF y aranceles según el peso FOB de cada serie', () => {
      const items: CustomsItem[] = [
        {
          item_order: 1,
          item_code: 'LAP-GAMER-01',
          hs_code: '8471300000',
          commercial_description: 'Laptop Gamer 16GB',
          quantity: 10,
          unit_code: 'NIU',
          fob_unit_usd: 600,
        },
        {
          item_order: 2,
          item_code: 'MON-LED-27',
          hs_code: '8528520000',
          commercial_description: 'Monitor Curvo 144Hz',
          quantity: 20,
          unit_code: 'NIU',
          fob_unit_usd: 200,
        },
      ];

      const totalFobUsd = 10000;
      const cifPen = 45600;
      const adValoremPen = 2736;

      const prorated = calculateItemProrating(items, totalFobUsd, cifPen, adValoremPen);

      expect(prorated).toHaveLength(2);

      // Serie 1: 60% del peso FOB ($6,000 / $10,000)
      expect(prorated[0].allocated_cif_pen).toBe(27360.0);
      expect(prorated[0].allocated_duties_pen).toBe(1641.6);
      expect(prorated[0].landed_cost_unit_pen).toBe(2900.16);

      // Serie 2: 40% del peso FOB ($4,000 / $10,000)
      expect(prorated[1].allocated_cif_pen).toBe(18240.0);
      expect(prorated[1].allocated_duties_pen).toBe(1094.4);
      expect(prorated[1].landed_cost_unit_pen).toBe(966.72);

      // La sumatoria de costos prorrateados debe cuadrar con el Landed Cost Total (S/ 48,336)
      const sumItemTotalLanded =
        prorated[0].quantity * prorated[0].landed_cost_unit_pen! +
        prorated[1].quantity * prorated[1].landed_cost_unit_pen!;
      expect(Math.round(sumItemTotalLanded)).toBe(48336);
    });
  });
});
