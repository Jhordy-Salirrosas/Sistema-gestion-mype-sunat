/**
 * Value Object para el número formal de Declaración Aduanera (DUA / DAM).
 * Formato SUNAT: Aduana (3) - Año (4) - Régimen (2) - Correlativo (6)
 * Ejemplo: 118-2026-10-012345
 */
export class DuaNumberVO {
  private static readonly DUA_REGEX = /^\d{3}-\d{4}-\d{2}-\d{6}$/;

  private readonly value: string;

  constructor(duaNumber: string) {
    if (!duaNumber || !DuaNumberVO.DUA_REGEX.test(duaNumber.trim())) {
      throw new Error(
        `Número de DUA/DAM inválido: '${duaNumber}'. Debe cumplir el formato 'XXX-YYYY-ZZ-NNNNNN' (ej. '118-2026-10-012345').`,
      );
    }
    this.value = duaNumber.trim();
  }

  getValue(): string {
    return this.value;
  }

  getCustomsAgencyCode(): string {
    return this.value.substring(0, 3);
  }

  getYear(): number {
    return parseInt(this.value.substring(4, 8), 10);
  }

  getRegimeCode(): string {
    return this.value.substring(9, 11);
  }

  getCorrelative(): string {
    return this.value.substring(12, 18);
  }
}
