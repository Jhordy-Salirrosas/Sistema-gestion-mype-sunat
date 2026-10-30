import { BadRequestException } from '@nestjs/common';
import { ParsePleFileUseCase } from '../../../src/modules/accounting/application/use-cases/parsePleFileUseCase';

describe('ParsePleFileUseCase', () => {
  let useCase: ParsePleFileUseCase;

  beforeEach(() => {
    useCase = new ParsePleFileUseCase();
  });

  it('debe procesar correctamente un archivo PLE válido de Diario (050100)', async () => {
    const validFileName = 'LE1234567890120230100050100001111.txt'; // 37 caracteres
    const content = '20230101|1|M1|10111|100.00|0.00|USD|1|\n';
    const buffer = Buffer.from(content, 'utf-8');

    const result = await useCase.execute(buffer, validFileName, 'company-id');

    expect(result.bookCode).toBe('050100');
    expect(result.totalEntriesProcessed).toBe(1);
    expect(result.status).toBe('PROCESSED_SUCCESSFULLY');
    expect(result.fileHash).toBeDefined();
  });

  it('debe lanzar BadRequestException si el nombre del archivo no tiene 37 caracteres', async () => {
    const invalidFileName = 'archivo_corto.txt';
    const buffer = Buffer.from('contenido');

    await expect(
      useCase.execute(buffer, invalidFileName, 'company-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar BadRequestException si el código de libro no es soportado', async () => {
    const invalidBookFileName = 'LE1234567890120230100999999001111.txt'; // Libro 999999
    const buffer = Buffer.from('contenido');

    await expect(
      useCase.execute(buffer, invalidBookFileName, 'company-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar BadRequestException si una fila tiene menos de 8 campos', async () => {
    const validFileName = 'LE1234567890120230100050100001111.txt';
    const invalidContent = '20230101|1|M1\n'; // Menos de 8 campos
    const buffer = Buffer.from(invalidContent, 'utf-8');

    await expect(
      useCase.execute(buffer, validFileName, 'company-id'),
    ).rejects.toThrow(BadRequestException);
  });
});