import { PleStructureValidatorService } from '../../../src/modules/inventory/infrastructure/adapters/pleStructureValidatorService';
import { Ple13_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple13_1FlatFileWriterAdapter';
import { Ple12_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple12_1FlatFileWriterAdapter';

describe('PLE Electronic Books Adapters (RS 234-2006/SUNAT)', () => {
  const validator = new PleStructureValidatorService();
  const ple13Adapter = new Ple13_1FlatFileWriterAdapter(validator);
  const ple12Adapter = new Ple12_1FlatFileWriterAdapter(validator);

  it('genera nombres oficiales estandarizados de 37 caracteres para PLE 13.1 y 12.1', () => {
    const name13 = validator.generateOfficialFileName('20601234567', 2026, '00', '130100', true);
    // LE2060123456720260000130100001111.txt = 37 caracteres exactos
    expect(name13).toBe('LE2060123456720260000130100001111.txt');
    expect(name13.length).toBe(37);

    const name12 = validator.generateOfficialFileName('20601234567', 2026, '00', '120100', true);
    expect(name12).toBe('LE2060123456720260000120100001111.txt');
    expect(name12.length).toBe(37);
  });

  it('sanitiza pipes y saltos de línea en campos descriptivos', () => {
    const dirty = 'Laptop Asus | i7 \n 16GB\r\nRAM';
    const clean = validator.sanitizeField(dirty, 30);
    expect(clean).not.toContain('|');
    expect(clean).not.toContain('\n');
    expect(clean.length).toBeLessThanOrEqual(30);
  });

  it('genera archivo plano para Registro de Inventario Permanente Valorizado (PLE 13.1 - 27 campos)', () => {
    const movements = [
      {
        periodYearMonth: '20260000',
        cuo: 'M-2026-1',
        entryNumber: 'M1',
        establishmentCode: '0000',
        catalogCode: '9',
        typeCode: '01',
        sku: 'LAP-001',
        documentDate: new Date('2026-03-25T10:00:00Z'),
        documentTypeCode: '50',
        documentSerial: '118',
        documentNumber: '123456',
        operationTypeCode: '18',
        description: 'Laptop Gamer Core i7',
        unitCode: 'NIU',
        valuationMethodCode: '2',
        direction: 'ENTRADA' as const,
        quantity: 10,
        unitCost: 3500,
        totalCost: 35000,
        resultingStock: 10,
        resultingAverageCost: 3500,
        resultingTotalValue: 35000,
      },
    ];

    const result = ple13Adapter.generate('20601234567', 2026, movements);
    expect(result.recordsCount).toBe(1);
    expect(result.fileName).toBe('LE2060123456720260000130100001111.txt');

    const firstLine = result.content.trim();
    expect(firstLine.endsWith('|')).toBe(true);
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    expect(pipeCount).toBe(27);
    expect(firstLine).toContain('LAP-001');
    expect(firstLine).toContain('35000.00');
  });

  it('genera archivo plano para Registro en Unidades Físicas (PLE 12.1 - 20 campos)', () => {
    const movements = [
      {
        periodYearMonth: '20260000',
        cuo: 'M-2026-1',
        entryNumber: 'M1',
        establishmentCode: '0000',
        typeCode: '01',
        sku: 'LAP-001',
        documentDate: new Date('2026-03-25T10:00:00Z'),
        documentTypeCode: '50',
        documentSerial: '118',
        documentNumber: '123456',
        operationTypeCode: '18',
        description: 'Laptop Gamer Core i7',
        unitCode: 'NIU',
        direction: 'ENTRADA' as const,
        quantity: 10,
        resultingStock: 10,
      },
    ];

    const result = ple12Adapter.generate('20601234567', 2026, movements);
    expect(result.recordsCount).toBe(1);
    expect(result.fileName).toBe('LE2060123456720260000120100001111.txt');

    const firstLine = result.content.trim();
    expect(firstLine.endsWith('|')).toBe(true);
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    expect(pipeCount).toBe(20);
  });
});
