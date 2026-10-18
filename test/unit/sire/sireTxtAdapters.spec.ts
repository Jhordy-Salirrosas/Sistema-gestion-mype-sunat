import { SireTxtParserAdapter } from '../../../src/modules/sire/infrastructure/parsers/sireTxtParserAdapter';
import { SireTxtWriterAdapter } from '../../../src/modules/sire/infrastructure/parsers/sireTxtWriterAdapter';

describe('SIRE TXT adapters (provisional formats)', () => {
  it('parses valid provisional rows and reports invalid lines', () => {
    const parser = new SireTxtParserAdapter();
    const result = parser.parse(
      Buffer.from(
        [
          '20100070970|01|F001|0001|2026-03-01|100.00|18.00|118.00|CAR-1|',
          'malformed|row',
        ].join('\n'),
      ),
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].carSunat).toBe('CAR-1');
    expect(result.rejected).toEqual([
      { line: 2, reason: 'La fila no contiene las 9 columnas mínimas.' },
    ]);
  });

  it('rejects unsupported encodings instead of silently corrupting input', () => {
    const parser = new SireTxtParserAdapter();
    expect(() => parser.parse(Buffer.from([0xc3, 0x28]))).toThrow(
      'El archivo TXT debe estar codificado en UTF-8.',
    );
  });

  it('exports a clearly marked draft and prevents delimiter injection', () => {
    const writer = new SireTxtWriterAdapter();
    const file = writer.export({
      period: '202603',
      bookType: 'RVIE',
      discrepancies: [],
    });

    expect(file.fileName).toContain('BORRADOR');
    expect(file.content.toString('utf8')).toContain('RUC_EMISOR|');
    expect(() =>
      writer.export({
        period: '202603',
        bookType: 'RVIE',
        discrepancies: [
          {
            discrepancyType: 'OMISION_SUNAT',
            emitterRuc: '2010|0070970',
            documentType: '01',
            series: 'F001',
            correlative: '1',
            amountDifference: 1,
          },
        ],
      }),
    ).toThrow('El registro contiene caracteres incompatibles con TXT.');
  });
});
