/**
 * Value Object para el Código de Documento Aduanero (CDA) de SUNAT.
 * Utilizado para el pago electrónico (Teledespacho) de liquidaciones aduaneras en banca comercial.
 * Soporta formato teledespacho estándar (14 dígitos) y formato extendido oficial (18 dígitos).
 * Ejemplos: '11826100104589' (14D) o '118202610001004589' (18D).
 */
export class CdaNumberVO {
  private static readonly CDA_REGEX = /^(\d{14}|\d{18})$/;
  private readonly value: string;

  constructor(cda: string) {
    if (!cda) {
      throw new Error('El Código de Documento Aduanero (CDA) no puede estar vacío.');
    }

    const trimmed = cda.trim();
    if (!CdaNumberVO.CDA_REGEX.test(trimmed)) {
      throw new Error(
        `Código de Documento Aduanero (CDA) inválido: '${cda}'. Debe contener exactamente 14 o 18 dígitos numéricos.`,
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
   * Año de emisión
   */
  getYear(): string {
    return this.value.length === 18
      ? this.value.substring(3, 7)
      : this.value.substring(3, 5);
  }

  /**
   * Año de emisión en 2 dígitos (ej. '26' para 2026)
   */
  getYearTwoDigits(): string {
    return this.value.length === 18
      ? this.value.substring(5, 7)
      : this.value.substring(3, 5);
  }

  /**
   * Tipo de liquidación / cuota (ej. '0010', '0026', '0027', '1001')
   */
  getSettlementTypeCode(): string {
    return this.value.length === 18
      ? this.value.substring(9, 13)
      : this.value.substring(5, 9);
  }

  /**
   * Correlativo de liquidación (últimos 5 dígitos)
   */
  getCorrelative(): string {
    return this.value.substring(this.value.length - 5);
  }
}
