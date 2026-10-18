/**
 * Value Object para el Código de Documento Aduanero (CDA) de SUNAT.
 * Utilizado para el pago electrónico (Teledespacho) de liquidaciones aduaneras en banca comercial.
 * Formato SUNAT: 14 dígitos numéricos (ej. '11826100104589').
 */
export class CdaNumberVO {
  private static readonly CDA_REGEX = /^\d{14}$/;
  private readonly value: string;

  constructor(cda: string) {
    if (!cda) {
      throw new Error('El Código de Documento Aduanero (CDA) no puede estar vacío.');
    }

    const trimmed = cda.trim();
    if (!CdaNumberVO.CDA_REGEX.test(trimmed)) {
      throw new Error(
        `Código de Documento Aduanero (CDA) inválido: '${cda}'. Debe contener exactamente 14 dígitos numéricos.`,
      );
    }

    this.value = trimmed;
  }

  getValue(): string {
    return this.value;
  }

  /**
   * Código de la aduana operativa (primeros 3 dígitos)
   */
  getCustomsCode(): string {
    return this.value.substring(0, 3);
  }

  /**
   * Año de emisión (dígitos 4 y 5, ej. '26' para 2026)
   */
  getYearTwoDigits(): string {
    return this.value.substring(3, 5);
  }

  /**
   * Tipo de liquidación / cuota (dígitos 6 al 9, ej. '0010', '0026', '0027')
   */
  getSettlementTypeCode(): string {
    return this.value.substring(5, 9);
  }

  /**
   * Correlativo de liquidación (últimos 5 dígitos)
   */
  getCorrelative(): string {
    return this.value.substring(9, 14);
  }
}
