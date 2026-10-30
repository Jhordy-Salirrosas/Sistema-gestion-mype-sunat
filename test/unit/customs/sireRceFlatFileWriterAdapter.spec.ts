import {
  SireRceFlatFileWriterAdapter,
  SireRceAnnex8_4Item,
} from '../../../src/modules/customs/infrastructure/adapters/sireRceFlatFileWriterAdapter';

describe('SireRceFlatFileWriterAdapter (Infrastructure Adapter)', () => {
  it('debe generar el nombre reglamentario de archivo de 37 caracteres según Res. 000112-2021', () => {
    const fileName = SireRceFlatFileWriterAdapter.generateFileName('20601234567', '2026', '10');
    expect(fileName).toBe('LE2060123456720261000080400001111.txt');
    expect(fileName.length).toBe(37);
  });

  it('debe estructurar cada línea con formato pipe | y terminar en | con tipo comprobante 50', () => {
    const record: SireRceAnnex8_4Item = {
      period: '202610',
      cuo: 'CUO-0010042',
      correlativeNumber: 'M00001',
      documentIssueDate: '2026-10-18',
      customsCode: '118',
      numerationYear: 2026,
      correlativeDua: '004200',
      taxpayerId: '99999999999',
      supplierName: 'SHENZHEN TECH CO. LTD',
      taxableBasePen: 197016.5,
      igvIpmPen: 35462.97,
      perceptionPen: 8136.78,
      totalImportCostPen: 207892.5,
      statusCode: '1',
    };

    const line = SireRceFlatFileWriterAdapter.buildLine(record);
    expect(line.startsWith('202610|CUO-0010042|')).toBe(true);
    expect(line.endsWith('|')).toBe(true);
    expect(line).toContain('|50|118|2026|004200|');
    expect(line).toContain('|197016.50|35462.97|8136.78|207892.50|1|');
  });

  it('debe generar el archivo plano completo con salto de línea CRLF', () => {
    const record: SireRceAnnex8_4Item = {
      period: '202610',
      cuo: 'CUO-1',
      correlativeNumber: 'M00001',
      documentIssueDate: '2026-10-01',
      customsCode: '118',
      numerationYear: 2026,
      correlativeDua: '000001',
      supplierName: 'GLOBAL SUPPLIER',
      taxableBasePen: 1000,
      igvIpmPen: 180,
      perceptionPen: 35,
      totalImportCostPen: 1000,
    };

    const result = SireRceFlatFileWriterAdapter.generateFlatFile('20601234567', 2026, 10, [record]);
    expect(result.fileName).toBe('LE2060123456720261000080400001111.txt');
    expect(result.content.endsWith('\r\n')).toBe(true);
  });
});

