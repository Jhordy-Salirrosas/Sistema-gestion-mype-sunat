/**
 * Value Object para la Subpartida Nacional (SPN) del Arancel de Aduanas del Perú.
 * Formato SUNAT: 10 dígitos numéricos (ej. '8471.30.00.00' o '8471300000').
 */
export class HsCodeVO {
  private static readonly CLEAN_REGEX = /^\d{10}$/;
  private readonly cleanValue: string;

  constructor(rawCode: string) {
    if (!rawCode) {
      throw new Error('La subpartida nacional no puede estar vacía.');
    }

    const sanitized = rawCode.replace(/[.\-\s]/g, '');
    if (!HsCodeVO.CLEAN_REGEX.test(sanitized)) {
      throw new Error(
        `Subpartida arancelaria inválida: '${rawCode}'. Debe contener exactamente 10 dígitos numéricos (ej. '8471.30.00.00').`,
      );
    }

    this.cleanValue = sanitized;
  }

  getValue(): string {
    return this.cleanValue;
  }

  /**
   * Retorna el formato estándar de SUNAT con puntos: XXXX.XX.XX.XX
   */
  getFormatted(): string {
    return `${this.cleanValue.substring(0, 4)}.${this.cleanValue.substring(4, 6)}.${this.cleanValue.substring(6, 8)}.${this.cleanValue.substring(8, 10)}`;
  }

  getChapter(): string {
    return this.cleanValue.substring(0, 2);
  }

  getHeading(): string {
    return this.cleanValue.substring(0, 4);
  }

  getSubheading(): string {
    return this.cleanValue.substring(0, 6);
  }
}
