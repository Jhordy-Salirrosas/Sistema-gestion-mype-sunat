export class SunatTable6VO {
  private static readonly VALID_UNITS: Record<string, string> = {
    NIU: 'UNIDAD (BIENES)',
    KGM: 'KILOGRAMOS',
    LTR: 'LITROS',
    MTR: 'METROS',
    MTK: 'METROS CUADRADOS',
    MTQ: 'METROS CUBICOS',
    BX: 'CAJAS',
    PK: 'PAQUETES',
    SET: 'JUEGO / CONJUNTO',
    DZN: 'DOCENAS',
    GRM: 'GRAMOS',
    TNE: 'TONELADAS',
    ZZ: 'UNIDAD DE MEDIDA DE SERVICIOS / MUTUO ACUERDO',
  };

  private readonly _code: string;

  constructor(code: string) {
    const sanitized = (code || '').trim().toUpperCase();
    if (!SunatTable6VO.VALID_UNITS[sanitized]) {
      throw new Error(
        `Código de unidad de medida "${sanitized}" no es válido según Tabla 6 SUNAT.`,
      );
    }
    this._code = sanitized;
  }

  get code(): string {
    return this._code;
  }

  get description(): string {
    return SunatTable6VO.VALID_UNITS[this._code];
  }

  static isValid(code: string): boolean {
    return Boolean(SunatTable6VO.VALID_UNITS[(code || '').trim().toUpperCase()]);
  }
}

