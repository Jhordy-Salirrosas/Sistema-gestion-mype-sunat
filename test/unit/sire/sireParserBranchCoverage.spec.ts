import { BadRequestException } from '@nestjs/common';
import type * as XLSXTypes from 'xlsx';
import { SireReportFileParser } from '../../../src/modules/sire/infrastructure/parsers/sireReportFileParser';
import { SireTxtParserAdapter } from '../../../src/modules/sire/infrastructure/parsers/sireTxtParserAdapter';

const xlsx = jest.requireActual<typeof XLSXTypes>('xlsx');

const reportHeader = [
  'RUC emisor',
  'Tipo comprobante',
  'Serie',
  'Correlativo',
  'Fecha emisión',
  'Base imponible',
  'IGV',
  'Importe total',
  'CAR',
];

const reportRow = [
  '20100070970',
  '01',
  'F001',
  '1',
  '2026-10-01',
  '100.00',
  '18.00',
  '118.00',
  'CAR-1',
];

const buildWorkbook = (rows: unknown[][]): Buffer => {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'RCE');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

describe('SireReportFileParser branch coverage', () => {
  const parser = new SireReportFileParser();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a workbook whose first sheet cannot be read', () => {
    jest.spyOn(xlsx, 'read').mockReturnValue({
      SheetNames: [],
      Sheets: {},
    } as unknown as XLSXTypes.WorkBook);

    expect(() => parser.parse(Buffer.from('PK'))).toThrow(
      new BadRequestException(
        'No se pudo leer el archivo: El archivo no contiene hojas.',
      ),
    );
  });

  it('reports an invalid format when the reader fails with a non error value', () => {
    const failure = { message: 'binario ilegible' };
    jest.spyOn(xlsx, 'read').mockImplementation(() => {
      throw failure;
    });

    expect(() => parser.parse(Buffer.from('PK'))).toThrow(
      new BadRequestException('No se pudo leer el archivo: formato inválido'),
    );
  });

  it('rejects a workbook without a header row', () => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([]), 'RCE');

    expect(() =>
      parser.parse(
        xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      ),
    ).toThrow(new BadRequestException('El archivo no contiene encabezado.'));
  });

  it('skips rows that only contain empty cells and keeps the source line', () => {
    const result = parser.parse(
      buildWorkbook([
        reportHeader,
        ['', '', '', '', '', '', '', '', ''],
        reportRow,
        [
          'invalid-ruc',
          '01',
          'F001',
          '2',
          '2026-10-01',
          '100.00',
          '18.00',
          '118.00',
          'CAR-2',
        ],
      ]),
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      correlative: '1',
      carSunat: 'CAR-1',
    });
    expect(result.rejected).toEqual([
      { line: 4, reason: 'RUC, tipo, serie o correlativo inválido.' },
    ]);
  });

  it('treats a missing header label as an empty column', () => {
    jest
      .spyOn(xlsx.utils, 'sheet_to_json')
      .mockReturnValue([
        [...reportHeader, null],
        reportRow,
      ] as unknown as unknown[]);

    const result = parser.parse(Buffer.from('PK'));

    expect(result.rejected).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      emitterRuc: '20100070970',
      carSunat: 'CAR-1',
    });
  });

  it('treats missing row cells as empty values', () => {
    jest
      .spyOn(xlsx.utils, 'sheet_to_json')
      .mockReturnValue([
        reportHeader,
        [
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ],
        [
          undefined,
          '20100070970',
          '01',
          'F001',
          '1',
          '2026-10-01',
          '100.00',
          '18.00',
        ],
      ] as unknown as unknown[]);

    const result = parser.parse(Buffer.from('PK'));

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 3, reason: 'RUC, tipo, serie o correlativo inválido.' },
    ]);
  });

  it('rejects a row whose amount is not a valid number', () => {
    const result = parser.parse(
      buildWorkbook([
        reportHeader,
        [
          '20100070970',
          '01',
          'F001',
          '1',
          '2026-10-01',
          'no-es-un-monto',
          '18.00',
          '118.00',
          'CAR-1',
        ],
      ]),
    );

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 2, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row whose amount overflows to infinity', () => {
    const result = parser.parse(
      buildWorkbook([
        reportHeader,
        [
          '20100070970',
          '01',
          'F001',
          '1',
          '2026-10-01',
          '9'.repeat(400),
          '18.00',
          '118.00',
          'CAR-1',
        ],
      ]),
    );

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 2, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row with an invalid issue date', () => {
    const result = parser.parse(
      buildWorkbook([
        reportHeader,
        [
          '20100070970',
          '01',
          'F001',
          '1',
          '2026-13-45',
          '100.00',
          '18.00',
          '118.00',
          'CAR-1',
        ],
      ]),
    );

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 2, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });
});

describe('SireTxtParserAdapter branch coverage', () => {
  const parser = new SireTxtParserAdapter();

  const parseLines = (lines: string[]) =>
    parser.parse(Buffer.from(lines.join('\n')));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects rows with an invalid identification', () => {
    const result = parseLines([
      '20100070970|01|F001|0001|2026-03-01|100.00|18.00|118.00|CAR-1',
      'invalid-ruc|01|F001|0002|2026-03-01|100.00|18.00|118.00|CAR-2',
      '20100070970||F001|0003|2026-03-01|100.00|18.00|118.00|CAR-3',
      '20100070970|01||0004|2026-03-01|100.00|18.00|118.00|CAR-4',
      '20100070970|01|F001||2026-03-01|100.00|18.00|118.00|CAR-5',
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ carSunat: 'CAR-1' });
    expect(result.rejected).toEqual([
      { line: 2, reason: 'Identificación del comprobante inválida.' },
      { line: 3, reason: 'Identificación del comprobante inválida.' },
      { line: 4, reason: 'Identificación del comprobante inválida.' },
      { line: 5, reason: 'Identificación del comprobante inválida.' },
    ]);
  });

  it('rejects a row whose date is not written in ISO format', () => {
    const result = parseLines([
      '20100070970|01|F001|0001|01/03/2026|100.00|18.00|118.00|CAR-1',
    ]);

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 1, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row whose date is not a real calendar date', () => {
    const result = parseLines([
      '20100070970|01|F001|0001|2026-02-30|100.00|18.00|118.00|CAR-1',
    ]);

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 1, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row whose amount is not a valid number', () => {
    const result = parseLines([
      '20100070970|01|F001|0001|2026-03-01|abc|18.00|118.00|CAR-1',
    ]);

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 1, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row whose amount overflows to infinity', () => {
    const result = parseLines([
      `20100070970|01|F001|0001|2026-03-01|${'9'.repeat(400)}|18.00|118.00|CAR-1`,
    ]);

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 1, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });

  it('rejects a row without a CAR', () => {
    const result = parseLines([
      '20100070970|01|F001|0001|2026-03-01|100.00|18.00|118.00||',
    ]);

    expect(result.records).toEqual([]);
    expect(result.rejected).toEqual([
      { line: 1, reason: 'Fecha, monto o CAR inválido.' },
    ]);
  });
});
