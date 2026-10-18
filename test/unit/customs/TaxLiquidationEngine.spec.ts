import { TaxLiquidationEngine } from '../../../src/modules/customs/domain/rules/TaxLiquidationEngine';
import { SettlementType } from '../../../src/modules/customs/domain/enums/settlementType.enum';

describe('TaxLiquidationEngine (Domain Rule)', () => {
  describe('Caso de Estudio Real: 100 Laptops Gamer de Juan', () => {
    it('debe liquidar los tributos de importación con precisión matemática exacta', () => {
      const result = TaxLiquidationEngine.calculate({
        fobUsd: 50000.0,
        freightUsd: 4000.0,
        insuranceUsd: 500.0,
        exchangeRate: 3.75,
        adValoremRate: 0.0, // Subpartida 8471.30 tasa 0%
        perceptionRate: 3.5, // Importador habitual
        customsCode: '118',
        declarationYear: 2026,
        declarationCorrelative: '458921',
      });

      // 1. Base Imponible Aduanera
      expect(result.cifUsd).toBe(54500.0);
      expect(result.cifPen).toBe(204375.0);
      expect(result.isInsuranceTppsApplied).toBe(false);

      // 2. Derechos Arancelarios
      expect(result.adValoremRate).toBe(0.0);
      expect(result.adValoremPen).toBe(0.0);

      // 3. IGV 16% e IPM 2%
      expect(result.baseIgvIpmPen).toBe(204375.0);
      expect(result.igvPen).toBe(32700.0);
      expect(result.ipmPen).toBe(4087.5);
      expect(result.totalCustomsDutiesPen).toBe(36787.5); // Cuota 0010

      // 4. Percepción del IGV 3.5%
      expect(result.basePerceptionPen).toBe(241162.5);
      expect(result.perceptionPen).toBe(8440.69); // Cuota 0026

      // 5. Total a pagar en SUNAT
      expect(result.totalPayableToSunatPen).toBe(45228.19);

      // 6. Liquidaciones con CDA de 14 dígitos
      expect(result.settlements).toHaveLength(2);

      const cuota0010 = result.settlements.find(
        (s) => s.type === SettlementType.TIPO_0010_DECLARACION,
      );
      expect(cuota0010).toBeDefined();
      expect(cuota0010?.amountPen).toBe(36787.5);
      expect(cuota0010?.cdaNumber).toBe('11826001058921'); // 118 + 26 + 0010 + 58921
      expect(cuota0010?.cdaNumber).toHaveLength(14);

      const cuota0026 = result.settlements.find(
        (s) => s.type === SettlementType.TIPO_0026_MAYOR_VALOR,
      );
      expect(cuota0026).toBeDefined();
      expect(cuota0026?.amountPen).toBe(8440.69);
      expect(cuota0026?.cdaNumber).toBe('11826002658921');
      expect(cuota0026?.cdaNumber).toHaveLength(14);
    });
  });

  describe('Aplicación de Tabla de Porcentajes Promedio de Seguro (TPPS)', () => {
    it('debe aplicar la tasa TPPS de 0.75% para computadoras (Capítulo 84) cuando no hay seguro contratado', () => {
      const result = TaxLiquidationEngine.calculate({
        fobUsd: 10000.0,
        freightUsd: 1000.0,
        insuranceUsd: null, // Sin póliza efectiva
        hsCode: '8471.30.00.00',
        exchangeRate: 3.75,
        adValoremRate: 0.0,
        perceptionRate: 3.5,
      });

      expect(result.isInsuranceTppsApplied).toBe(true);
      expect(result.tppsInsuranceRateUsed).toBe(0.75);
      expect(result.insuranceUsd).toBe(75.0); // 0.75% de 10,000
      expect(result.cifUsd).toBe(11075.0); // 10000 + 1000 + 75
      expect(result.cifPen).toBe(41531.25);
    });

    it('debe aplicar tasa residual de 1.50% si no se proporciona subpartida nacional', () => {
      const result = TaxLiquidationEngine.calculate({
        fobUsd: 2000.0,
        freightUsd: 200.0,
        exchangeRate: 3.8,
        adValoremRate: 6.0,
      });

      expect(result.isInsuranceTppsApplied).toBe(true);
      expect(result.tppsInsuranceRateUsed).toBe(1.5);
      expect(result.insuranceUsd).toBe(30.0); // 1.5% de 2000
    });
  });

  describe('Tasas Arancelarias y Percepciones Escalonadas', () => {
    it('debe liquidar correctamente con Ad-Valorem del 6% y Percepción del 10% (Sin RUC)', () => {
      const result = TaxLiquidationEngine.calculate({
        fobUsd: 5000.0,
        freightUsd: 500.0,
        insuranceUsd: 100.0,
        exchangeRate: 3.8,
        adValoremRate: 6.0,
        perceptionRate: 10.0,
      });

      const cifPen = 5600.0 * 3.8; // S/ 21,280.00
      const adValoremPen = cifPen * 0.06; // S/ 1,276.80
      const baseIgvIpm = cifPen + adValoremPen; // S/ 22,556.80
      const igvPen = baseIgvIpm * 0.16; // S/ 3,609.09
      const ipmPen = baseIgvIpm * 0.02; // S/ 451.14
      const totalDuties = adValoremPen + igvPen + ipmPen; // S/ 5,337.03
      const basePerception = cifPen + totalDuties; // S/ 26,617.03
      const perception = basePerception * 0.1; // S/ 2,661.70

      expect(result.adValoremPen).toBe(1276.8);
      expect(result.igvPen).toBe(3609.09);
      expect(result.ipmPen).toBe(451.14);
      expect(result.perceptionPen).toBe(2661.7);
    });
  });

  describe('Cálculo de Intereses Moratorios (TIM)', () => {
    it('debe generar liquidación Cuota 0027 por pago extemporáneo con TIM 0.03% diario', () => {
      const dueDate = new Date('2026-10-10');
      const paymentDate = new Date('2026-10-20'); // 10 días tarde

      const result = TaxLiquidationEngine.calculate({
        fobUsd: 10000.0,
        freightUsd: 1000.0,
        insuranceUsd: 200.0,
        exchangeRate: 3.75,
        adValoremRate: 6.0,
        dueDate,
        paymentDate,
      });

      expect(result.daysLate).toBe(10);
      expect(result.moratoriumInterestPen).toBeGreaterThan(0);

      const cuota0027 = result.settlements.find((s) => s.typeCode === '0027');
      expect(cuota0027).toBeDefined();
      expect(cuota0027?.type).toBe(SettlementType.TIPO_0027_MULTA);
    });
  });

  describe('Validaciones de Entrada', () => {
    it('debe arrojar error si el valor FOB es menor o igual a cero', () => {
      expect(() =>
        TaxLiquidationEngine.calculate({
          fobUsd: 0,
          freightUsd: 100,
          exchangeRate: 3.75,
          adValoremRate: 0,
        }),
      ).toThrow('El valor FOB debe ser un monto estrictamente positivo.');
    });

    it('debe arrojar error si la tasa Ad-Valorem no es oficial (0, 6 u 11%)', () => {
      expect(() =>
        TaxLiquidationEngine.calculate({
          fobUsd: 1000,
          freightUsd: 100,
          exchangeRate: 3.75,
          adValoremRate: 8, // Tasa inexistente en Perú
        }),
      ).toThrow(/Tasa Ad-Valorem inválida/);
    });
  });
});
