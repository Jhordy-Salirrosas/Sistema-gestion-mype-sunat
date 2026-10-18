import { getTppsInsuranceRate } from '../constants/insuranceTpps.constant';
import { SettlementType } from '../enums/settlementType.enum';

export interface TaxLiquidationInput {
  fobUsd: number;
  freightUsd: number;
  insuranceUsd?: number | null;
  hsCode?: string;
  exchangeRate: number;
  adValoremRate: number; // 0, 6 u 11
  perceptionRate?: number; // 3.5, 5 o 10 (por defecto 3.5)
  customsCode?: string; // 118 Callao
  declarationYear?: number;
  declarationCorrelative?: string;
  dueDate?: Date;
  paymentDate?: Date;
}

export interface SettlementDraft {
  type: SettlementType;
  typeCode: string; // '0010', '0026', '0027'
  description: string;
  amountPen: number;
  amountUsd: number;
  cdaNumber: string;
}

export interface TaxLiquidationResult {
  // Valores Base
  fobUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  isInsuranceTppsApplied: boolean;
  tppsInsuranceRateUsed?: number;
  cifUsd: number;
  exchangeRate: number;
  cifPen: number;

  // Tributos
  adValoremRate: number;
  adValoremPen: number;
  baseIgvIpmPen: number;
  igvRate: number; // 16.0
  igvPen: number;
  ipmRate: number; // 2.0
  ipmPen: number;
  totalCustomsDutiesPen: number; // Ad-Valorem + IGV + IPM (Cuota 0010)

  // Percepción
  basePerceptionPen: number;
  perceptionRate: number;
  perceptionPen: number; // Cuota 0026

  // Intereses moratorios (si aplica pago extemporáneo)
  daysLate: number;
  moratoriumInterestPen: number;

  // Total exigible en aduana
  totalPayableToSunatPen: number;

  // Liquidaciones de Cobranza con CDA
  settlements: SettlementDraft[];
}

export class TaxLiquidationEngine {
  private static readonly DEFAULT_PERCEPTION_RATE = 3.5;
  private static readonly DAILY_TIM_RATE = 0.0003; // TIM 0.03% diario (R.S. SUNAT)

  /**
   * Ejecuta la liquidación tributaria oficial de importación conforme a las normativas de SUNAT
   */
  public static calculate(input: TaxLiquidationInput): TaxLiquidationResult {
    this.validateInputs(input);

    const fobUsd = this.round(input.fobUsd, 2);
    const freightUsd = this.round(input.freightUsd, 2);

    // 1. Determinar Seguro (Contratado vs TPPS)
    let insuranceUsd: number;
    let isInsuranceTppsApplied = false;
    let tppsInsuranceRateUsed: number | undefined;

    if (input.insuranceUsd !== undefined && input.insuranceUsd !== null && input.insuranceUsd > 0) {
      insuranceUsd = this.round(input.insuranceUsd, 2);
    } else {
      isInsuranceTppsApplied = true;
      tppsInsuranceRateUsed = getTppsInsuranceRate(input.hsCode);
      insuranceUsd = this.round(fobUsd * (tppsInsuranceRateUsed / 100), 2);
    }

    // 2. Valor CIF
    const cifUsd = this.round(fobUsd + freightUsd + insuranceUsd, 2);
    const exchangeRate = Number(input.exchangeRate.toFixed(4));
    const cifPen = this.round(cifUsd * exchangeRate, 2);

    // 3. Ad-Valorem
    const adValoremRate = input.adValoremRate;
    const adValoremPen = this.round(cifPen * (adValoremRate / 100), 2);

    // 4. IGV (16%) e IPM (2%)
    const baseIgvIpmPen = this.round(cifPen + adValoremPen, 2);
    const igvRate = 16.0;
    const ipmRate = 2.0;
    const igvPen = this.round(baseIgvIpmPen * 0.16, 2);
    const ipmPen = this.round(baseIgvIpmPen * 0.02, 2);
    const totalCustomsDutiesPen = this.round(adValoremPen + igvPen + ipmPen, 2);

    // 5. Percepción del IGV (R.S. 203-2003/SUNAT)
    const basePerceptionPen = this.round(cifPen + totalCustomsDutiesPen, 2);
    const perceptionRate = input.perceptionRate ?? this.DEFAULT_PERCEPTION_RATE;
    const perceptionPen = this.round(basePerceptionPen * (perceptionRate / 100), 2);

    // 6. Intereses Moratorios (TIM) si hay pago extemporáneo
    let daysLate = 0;
    let moratoriumInterestPen = 0;

    if (input.dueDate && input.paymentDate && input.paymentDate > input.dueDate) {
      const diffTime = input.paymentDate.getTime() - input.dueDate.getTime();
      daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      moratoriumInterestPen = this.round(
        totalCustomsDutiesPen * this.DAILY_TIM_RATE * daysLate,
        2,
      );
    }

    const totalPayableToSunatPen = this.round(
      totalCustomsDutiesPen + perceptionPen + moratoriumInterestPen,
      2,
    );

    // 7. Generación de Cuotas de Liquidación con CDA
    const customsCode = input.customsCode ?? '118';
    const year = input.declarationYear ?? new Date().getFullYear();
    const correlative = input.declarationCorrelative ?? '000001';

    const settlements: SettlementDraft[] = [
      {
        type: SettlementType.TIPO_0010_DECLARACION,
        typeCode: '0010',
        description: 'Liquidación de Derechos Arancelarios e Impuestos DAM',
        amountPen: totalCustomsDutiesPen,
        amountUsd: this.round(totalCustomsDutiesPen / exchangeRate, 2),
        cdaNumber: this.generateCda(customsCode, year, '0010', correlative),
      },
      {
        type: SettlementType.TIPO_0026_MAYOR_VALOR,
        typeCode: '0026',
        description: 'Liquidación de Percepción del IGV a la Importación Definitiva',
        amountPen: perceptionPen,
        amountUsd: this.round(perceptionPen / exchangeRate, 2),
        cdaNumber: this.generateCda(customsCode, year, '0026', correlative),
      },
    ];

    if (moratoriumInterestPen > 0) {
      settlements.push({
        type: SettlementType.TIPO_0027_MULTA,
        typeCode: '0027',
        description: `Liquidación de Intereses Moratorios por Pago Extemporáneo (${daysLate} días)`,
        amountPen: moratoriumInterestPen,
        amountUsd: this.round(moratoriumInterestPen / exchangeRate, 2),
        cdaNumber: this.generateCda(customsCode, year, '0027', correlative),
      });
    }

    return {
      fobUsd,
      freightUsd,
      insuranceUsd,
      isInsuranceTppsApplied,
      tppsInsuranceRateUsed,
      cifUsd,
      exchangeRate,
      cifPen,
      adValoremRate,
      adValoremPen,
      baseIgvIpmPen,
      igvRate,
      igvPen,
      ipmRate,
      ipmPen,
      totalCustomsDutiesPen,
      basePerceptionPen,
      perceptionRate,
      perceptionPen,
      daysLate,
      moratoriumInterestPen,
      totalPayableToSunatPen,
      settlements,
    };
  }

  /**
   * Genera el Código de Documento Aduanero (CDA) de 14 dígitos oficial de SUNAT
   * Estructura: Aduana (3) + Año (2) + Tipo Cuota (4) + Correlativo (5)
   */
  public static generateCda(
    customsCode: string,
    year: number,
    typeCode: string,
    correlative: string,
  ): string {
    const cleanCustoms = customsCode.padStart(3, '0').substring(0, 3);
    const cleanYear = year.toString().slice(-2);
    const cleanTypeCode = typeCode.padStart(4, '0').substring(0, 4);
    const cleanCorrelative = correlative.replace(/\D/g, '').padStart(5, '0').slice(-5);

    return `${cleanCustoms}${cleanYear}${cleanTypeCode}${cleanCorrelative}`;
  }

  private static validateInputs(input: TaxLiquidationInput): void {
    if (input.fobUsd <= 0) {
      throw new Error('El valor FOB debe ser un monto estrictamente positivo.');
    }
    if (input.freightUsd < 0) {
      throw new Error('El flete internacional no puede ser negativo.');
    }
    if (input.exchangeRate <= 0) {
      throw new Error('El tipo de cambio debe ser mayor a cero.');
    }
    if (![0, 6, 11].includes(input.adValoremRate)) {
      throw new Error(
        `Tasa Ad-Valorem inválida: ${input.adValoremRate}%. Solo se permiten tasas oficiales de 0%, 6% u 11%.`,
      );
    }
    if (input.perceptionRate !== undefined && ![3.5, 5, 10].includes(input.perceptionRate)) {
      throw new Error(
        `Tasa de Percepción inválida: ${input.perceptionRate}%. Solo se permiten tasas normadas de 3.5%, 5% o 10%.`,
      );
    }
  }

  private static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
