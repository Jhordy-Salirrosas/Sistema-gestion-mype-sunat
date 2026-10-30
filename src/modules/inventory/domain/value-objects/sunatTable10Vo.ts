export class SunatTable10VO {
  private static readonly VALID_DOCS: Record<string, string> = {
    '01': 'FACTURA',
    '03': 'BOLETA DE VENTA',
    '07': 'NOTA DE CREDITO',
    '08': 'NOTA DE DEBITO',
    '09': 'GUIA DE REMISION - REMITENTE',
    '12': 'TICKET O CINTA EMITIDO POR MAQUINA REGISTRADORA',
    '13': 'DOCUMENTO EMITIDO POR BANCOS',
    '31': 'GUIA DE REMISION - TRANSPORTISTA',
    '50': 'DECLARACION ADUANERA DE MERCANCIAS (DAM/DUA)',
    '52': 'DESPACHO SIMPLIFICADO DE IMPORTACION',
    '00': 'OTROS / DOCUMENTO INTERNO',
  };

  private readonly _code: string;

  constructor(code: string) {
    const sanitized = (code || '').trim();
    if (!SunatTable10VO.VALID_DOCS[sanitized]) {
      throw new Error(
        `Código de tipo de comprobante "${sanitized}" no es válido según Tabla 10 SUNAT.`,
      );
    }
    this._code = sanitized;
  }

  get code(): string {
    return this._code;
  }

  get description(): string {
    return SunatTable10VO.VALID_DOCS[this._code];
  }

  static isValid(code: string): boolean {
    return Boolean(SunatTable10VO.VALID_DOCS[(code || '').trim()]);
  }
}

