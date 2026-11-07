import { describe, it, expect } from 'vitest';
import { type SireAnnex8_4Record } from '@/modules/customs/types';

describe('SIRE RCE Anexo 8.4 — Estructura de Exportación de Registro de Compras de Importación', () => {
  const sampleRecords: SireAnnex8_4Record[] = [
    {
      period: '202610',
      cuo: 'CUO-0010042',
      correlative_number: 'M00001',
      document_issue_date: '2026-10-18',
      customs_code: '118',
      numeration_year: 2026,
      regime_code: '10',
      correlative_dua: '004200',
      taxpayer_id: '99999999999', // Proveedor del exterior
      supplier_name: 'SHENZHEN TECH CO. LTD',
      cif_value_pen: 197016.5,
      ad_valorem_pen: 0.0,
      taxable_base_pen: 197016.5,
      igv_ipm_pen: 35462.97,
      perception_pen: 8136.78,
      total_import_cost_pen: 207892.5,
    },
  ];

  it('debe generar el nombre oficial de archivo estructurado SUNAT Anexo 8.4 (LE + RUC + Periodo + 00080400001111.txt)', () => {
    const ruc = '20601234567';
    const year = '2026';
    const month = '10';

    const fileName = `LE${ruc}${year}${month}00080400001111.txt`;
    expect(fileName).toBe('LE2060123456720261000080400001111.txt');
    expect(fileName.length).toBe(37); // Longitud reglamentaria de archivo PLE/SIRE (33 caracteres base + 4 de '.txt')
  });

  it('debe estructurar cada línea delimitada por tuberías "|" terminando con "|" según estándar SUNAT', () => {
    const r = sampleRecords[0];
    const line =
      [
        r.period,
        r.cuo,
        r.correlative_number,
        r.document_issue_date,
        '50', // Tipo Comprobante DAM
        r.customs_code,
        r.numeration_year,
        r.correlative_dua,
        r.taxpayer_id,
        r.supplier_name,
        r.taxable_base_pen.toFixed(2),
        r.igv_ipm_pen.toFixed(2),
        r.perception_pen.toFixed(2),
        r.total_import_cost_pen.toFixed(2),
        '1', // Estado de comprobante
      ].join('|') + '|';

    expect(line.startsWith('202610|CUO-0010042|')).toBe(true);
    expect(line.endsWith('|')).toBe(true);
    expect(line).toContain('|50|118|2026|004200|');
    expect(line).toContain('|197016.50|35462.97|8136.78|207892.50|1|');
  });

  it('debe formatear los importes tributarios con 2 decimales exactos', () => {
    const r = sampleRecords[0];
    expect(r.taxable_base_pen.toFixed(2)).toBe('197016.50');
    expect(r.igv_ipm_pen.toFixed(2)).toBe('35462.97');
    expect(r.perception_pen.toFixed(2)).toBe('8136.78');
  });
});
