import { BadRequestException } from '@nestjs/common';
import { SireReportFileParser } from '../../../src/modules/sire/infrastructure/parsers/sireReportFileParser';

describe('SireReportFileParser', () => {
  const parser = new SireReportFileParser();
  const header =
    'RUC emisor,Tipo comprobante,Serie,Correlativo,Fecha emisión,Base imponible,IGV,Importe total,CAR';

  it('parses a valid CSV and reports invalid rows with their source line', () => {
    const result = parser.parse(
      Buffer.from(
        `${header}\n20100070970,01,F001,1,2026-10-01,100.00,18.00,118.00,CAR-1\nbad,01,F001,2,2026-10-01,100,18,118,CAR-2`,
      ),
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      emitterRuc: '20100070970',
      documentType: '01',
      totalAmount: 118,
      carSunat: 'CAR-1',
    });
    expect(result.rejected).toEqual([
      { line: 3, reason: 'RUC, tipo, serie o correlativo inválido.' },
    ]);
  });

  it('rejects a book without the required layout columns', () => {
    expect(() => parser.parse(Buffer.from('RUC,Serie\n20100070970,F001'))).toThrow(
      new BadRequestException(
        'Faltan columnas obligatorias: documentType, correlative, issueDate, taxableBase, igvAmount, totalAmount, carSunat (encabezado, fila 1).',
      ),
    );
  });
});
