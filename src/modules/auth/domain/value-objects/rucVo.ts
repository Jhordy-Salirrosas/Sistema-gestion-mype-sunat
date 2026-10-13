/**
 * Objeto de Valor (Value Object) que encapsula la validación formal y matemática de un RUC peruano.
 * Cumple con el algoritmo Módulo 11 oficial de SUNAT.
 */
export class RucVo {
  private readonly value: string;

  private constructor(ruc: string) {
    this.value = ruc;
  }

  public static create(ruc: string): RucVo {
    if (!ruc || typeof ruc !== 'string') {
      throw new Error('El RUC debe ser una cadena de texto no vacía.');
    }

    const trimmed = ruc.trim();
    if (!/^\d{11}$/.test(trimmed)) {
      throw new Error('El RUC debe contener exactamente 11 dígitos numéricos.');
    }

    const prefix = trimmed.substring(0, 2);
    if (!['10', '15', '17', '20'].includes(prefix)) {
      throw new Error(`Prefijo de RUC inválido: ${prefix}. Debe iniciar con 10, 15, 17 o 20.`);
    }

    if (!this.isValidModulo11(trimmed)) {
      throw new Error('El RUC no supera la validación matemática Módulo 11 de SUNAT.');
    }

    return new RucVo(trimmed);
  }

  public getValue(): string {
    return this.value;
  }

  private static isValidModulo11(ruc: string): boolean {
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 10; i++) {
      sum += parseInt(ruc.charAt(i), 10) * weights[i];
    }

    let diff = 11 - (sum % 11);
    if (diff === 10) diff = 0;
    if (diff === 11) diff = 1;

    return diff === parseInt(ruc.charAt(10), 10);
  }
}
