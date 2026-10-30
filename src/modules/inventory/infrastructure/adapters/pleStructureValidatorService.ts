import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PleStructureValidatorService {
  /**
   * Sanitiza y valida que un campo de texto no contenga pipes (|) ni saltos de línea prohibidos en PLE.
   */
  public sanitizeField(value: string | null | undefined, maxLength?: number): string {
    if (!value) return '';
    let sanitized = value.replace(/\|/g, ' ').replace(/[\r\n]+/g, ' ').trim();
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
  }

  /**
   * Valida la estructura del RUC (11 dígitos numéricos).
   */
  public validateRuc(ruc: string): string {
    const cleanRuc = (ruc || '').trim();
    if (!/^\d{11}$/.test(cleanRuc)) {
      throw new BadRequestException(`RUC inválido para generación de libro PLE: "${cleanRuc}".`);
    }
    return cleanRuc;
  }

  /**
   * Genera el nombre formal del archivo PLE según Res. 234-2006/SUNAT y modif.
   * Formato: LE + RUC(11) + AAAA(4) + MM(2) + 00 + ID_LIBRO(6) + COD_OP(2) + IND_OPERAC(1) + CONTENIDO(1) + MONEDA(1) + IND_PLE(1) + .txt
   * Total 33 caracteres base + extensión = 37 caracteres exactos.
   *
   * @param ruc RUC de la empresa (11 dígitos)
   * @param year Año fiscal (ej: 2026)
   * @param month Mes (ej: "00" o "12")
   * @param bookSubCode "120100" para PLE 12.1 o "130100" para PLE 13.1
   */
  public generateOfficialFileName(
    ruc: string,
    year: number,
    month: string = '00',
    bookSubCode: '120100' | '130100',
    hasInformation: boolean = true,
  ): string {
    const validRuc = this.validateRuc(ruc);
    const yyyy = String(year).padStart(4, '0');
    const mm = month.padStart(2, '0');
    const operationIndicator = '1'; // 1 = Empresa operativa
    const contentIndicator = hasInformation ? '1' : '0';
    const currencyIndicator = '1'; // 1 = Soles PEN
    const pleIndicator = '1'; // 1 = Generado por PLE

    return `LE${validRuc}${yyyy}${mm}00${bookSubCode}00${operationIndicator}${contentIndicator}${currencyIndicator}${pleIndicator}.txt`;
  }
}
