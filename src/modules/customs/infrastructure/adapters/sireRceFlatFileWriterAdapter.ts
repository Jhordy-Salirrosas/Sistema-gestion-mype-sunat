/**
 * Adaptador oficial para la generación del archivo plano RCE Compras de Importación
 * (Anexo 8.4 — Formato Tipo 50 DAM) según Resolución de Superintendencia N° 000112-2021/SUNAT.
 */

export interface SireRceAnnex8_4Item {
  period: string; // YYYYMM (ej. '202610')
  cuo: string; // Código Único de Operación
  correlativeNumber: string; // Correlativo de asiento (ej. 'M00001')
  documentIssueDate: string; // YYYY-MM-DD
  customsCode: string; // Código de aduana (ej. '118')
  numerationYear: number; // Año de numeración DAM (ej. 2026)
  regimeCode?: string; // Régimen (ej. '10')
  correlativeDua: string; // Correlativo de DAM (ej. '004200')
  taxpayerId?: string; // ID tributario o RUC proveedor
  supplierName: string;
  taxableBasePen: number;
  igvIpmPen: number;
  perceptionPen: number;
  totalImportCostPen: number;
  statusCode?: string; // Por defecto '1'
}

export class SireRceFlatFileWriterAdapter {
  /**
   * Genera el nombre oficial de archivo estructurado:
   * LE + RUC (11) + Año (4) + Mes (2) + 00080400001111.txt (37 caracteres)
   */
  public static generateFileName(ruc: string, year: string | number, month: string | number): string {
    const cleanRuc = ruc.trim().padStart(11, '0').slice(0, 11);
    const cleanYear = year.toString().slice(-4);
    const cleanMonth = month.toString().padStart(2, '0').slice(-2);

    return `LE${cleanRuc}${cleanYear}${cleanMonth}00080400001111.txt`;
  }

  /**
   * Genera una línea con formato de tuberías '|' terminando con '|' según especificación SUNAT
   */
  public static buildLine(record: SireRceAnnex8_4Item): string {
    const fields = [
      record.period,
      record.cuo,
      record.correlativeNumber,
      record.documentIssueDate,
      '50', // Tipo Comprobante SUNAT (50 = DAM / DUA de Importación)
      record.customsCode,
      record.numerationYear.toString(),
      record.correlativeDua,
      record.taxpayerId ?? '99999999999',
      record.supplierName.replace(/[|\r\n]/g, '').trim(),
      record.taxableBasePen.toFixed(2),
      record.igvIpmPen.toFixed(2),
      record.perceptionPen.toFixed(2),
      record.totalImportCostPen.toFixed(2),
      record.statusCode ?? '1',
    ];

    return fields.join('|') + '|';
  }

  /**
   * Genera el archivo plano completo en memoria
   */
  public static generateFlatFile(
    ruc: string,
    year: string | number,
    month: string | number,
    records: SireRceAnnex8_4Item[],
  ): { fileName: string; content: string } {
    const fileName = this.generateFileName(ruc, year, month);
    const lines = records.map((r) => this.buildLine(r));
    const content = lines.length > 0 ? lines.join('\r\n') + '\r\n' : '';

    return { fileName, content };
  }
}

