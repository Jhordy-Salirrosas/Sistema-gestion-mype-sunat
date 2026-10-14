import { BadRequestException } from '@nestjs/common';

export interface PleFileNameOptions {
  ruc: string;
  year: number | string;
  month: number | string;
  bookCode: string; // e.g. "140100" (Ventas) o "080100" (Compras)
  hasInformation?: boolean; // 1 = con info, 0 = sin info
  currency?: string; // 1 = PEN, 2 = USD
}

export class PleFileNameRule {
  /**
   * Genera el nombre oficial de archivo según RS N° 286-2009/SUNAT:
   * LE + RUC(11) + AÑO(4) + MES(2) + "00" + COD_LIBRO(6) + "00" + OP(1) + CONTENIDO(1) + MONEDA(1) + "1.txt"
   */
  static generate(options: PleFileNameOptions): string {
    const { ruc, year, month, bookCode, hasInformation = true, currency = 'PEN' } = options;

    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      throw new BadRequestException('El RUC para el archivo PLE debe tener exactamente 11 dígitos numéricos');
    }

    const yearStr = String(year).padStart(4, '0');
    const monthStr = String(month).padStart(2, '0');
    const bookCodeStr = String(bookCode).padStart(6, '0');
    const infoFlag = hasInformation ? '1' : '0';
    const currencyFlag = currency === 'USD' ? '2' : '1';

    // Estructura oficial fija SUNAT: LE + RUC + AAAA + MM + 00 + LLLLLL + 00 + 1 + C + M + 1.txt
    return `LE${ruc}${yearStr}${monthStr}00${bookCodeStr}001${infoFlag}${currencyFlag}1.txt`;
  }
}
