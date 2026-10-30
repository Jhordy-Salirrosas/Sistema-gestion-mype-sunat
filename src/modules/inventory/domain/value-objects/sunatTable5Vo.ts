export class SunatTable5VO {
  private static readonly VALID_TYPES: Record<string, string> = {
    '01': 'MERCADERIAS',
    '02': 'PRODUCTOS TERMINADOS',
    '03': 'MATERIAS PRIMAS',
    '04': 'ENVASES Y EMBALAJES',
    '05': 'MATERIALES AUXILIARES, SUMINISTROS Y REPUESTOS',
    '06': 'PRODUCTOS EN PROCESO',
    '07': 'REPUESTOS',
    '99': 'OTROS',
  };

  private readonly _code: string;

  constructor(code: string) {
    const sanitized = (code || '').trim();
    if (!SunatTable5VO.VALID_TYPES[sanitized]) {
      throw new Error(
        `Código de tipo de existencia "${sanitized}" no es válido según Tabla 5 SUNAT.`,
      );
    }
    this._code = sanitized;
  }

  get code(): string {
    return this._code;
  }

  get description(): string {
    return SunatTable5VO.VALID_TYPES[this._code];
  }

  static isValid(code: string): boolean {
    return Boolean(SunatTable5VO.VALID_TYPES[(code || '').trim()]);
  }
}

