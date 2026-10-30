export class SunatTable12VO {
  private static readonly VALID_OPERATIONS: Record<string, { desc: string; defaultDir: 'ENTRADA' | 'SALIDA' }> = {
    '01': { desc: 'VENTA NACIONAL', defaultDir: 'SALIDA' },
    '02': { desc: 'COMPRA NACIONAL', defaultDir: 'ENTRADA' },
    '03': { desc: 'CONSIGNACION RECIBIDA', defaultDir: 'ENTRADA' },
    '04': { desc: 'CONSIGNACION ENTREGADA', defaultDir: 'SALIDA' },
    '05': { desc: 'DEVOLUCION RECIBIDA', defaultDir: 'ENTRADA' },
    '06': { desc: 'DEVOLUCION ENTREGADA', defaultDir: 'SALIDA' },
    '07': { desc: 'BONIFICACION', defaultDir: 'SALIDA' },
    '08': { desc: 'PREMIO', defaultDir: 'SALIDA' },
    '09': { desc: 'DONACION', defaultDir: 'SALIDA' },
    '10': { desc: 'SALIDA A PRODUCCION', defaultDir: 'SALIDA' },
    '11': { desc: 'TRANSFERENCIA ENTRE ALMACENES', defaultDir: 'SALIDA' },
    '12': { desc: 'RETIRO', defaultDir: 'SALIDA' },
    '13': { desc: 'MERMAS', defaultDir: 'SALIDA' },
    '14': { desc: 'DESMEDROS', defaultDir: 'SALIDA' },
    '15': { desc: 'DESTRUCCION', defaultDir: 'SALIDA' },
    '16': { desc: 'SALDO INICIAL', defaultDir: 'ENTRADA' },
    '18': { desc: 'IMPORTACION', defaultDir: 'ENTRADA' },
    '19': { desc: 'ENTRADA DE PRODUCCION', defaultDir: 'ENTRADA' },
    '21': { desc: 'TRANSFERENCIA ENTRE ALMACENES (ENTRADA)', defaultDir: 'ENTRADA' },
    '22': { desc: 'TRANSFERENCIA ENTRE ALMACENES (SALIDA)', defaultDir: 'SALIDA' },
    '24': { desc: 'DEVOLUCION DEL CLIENTE', defaultDir: 'ENTRADA' },
    '25': { desc: 'DEVOLUCION AL PROVEEDOR', defaultDir: 'SALIDA' },
    '28': { desc: 'AJUSTE POR INVENTARIO FISICO', defaultDir: 'ENTRADA' },
    '99': { desc: 'OTROS', defaultDir: 'ENTRADA' },
  };

  private readonly _code: string;

  constructor(code: string) {
    const sanitized = (code || '').trim();
    if (!SunatTable12VO.VALID_OPERATIONS[sanitized]) {
      throw new Error(
        `Código de tipo de operación "${sanitized}" no es válido según Tabla 12 SUNAT.`,
      );
    }
    this._code = sanitized;
  }

  get code(): string {
    return this._code;
  }

  get description(): string {
    return SunatTable12VO.VALID_OPERATIONS[this._code].desc;
  }

  get defaultDirection(): 'ENTRADA' | 'SALIDA' {
    return SunatTable12VO.VALID_OPERATIONS[this._code].defaultDir;
  }

  static isValid(code: string): boolean {
    return Boolean(SunatTable12VO.VALID_OPERATIONS[(code || '').trim()]);
  }
}

