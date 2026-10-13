import { BadRequestException } from '@nestjs/common';
import { PleFileNameRule } from '../../../src/modules/accounting/domain/rules/pleFileNameRule';

describe('PleFileNameRule (Nomenclatura Oficial PLE RS 286-2009)', () => {
  it('debe generar el nombre oficial exacto para Registro de Ventas (140100)', () => {
    const fileName = PleFileNameRule.generate({
      ruc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '140100',
      hasInformation: true,
      currency: 'PEN',
    });

    // LE + 20100070970 + 2026 + 03 + 00 + 140100 + 00 + 1 + 1 + 1 + 1.txt
    expect(fileName).toBe('LE2010007097020260300140100001111.txt');
  });

  it('debe generar el nombre con indicador 0 cuando no hay información', () => {
    const fileName = PleFileNameRule.generate({
      ruc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '080100',
      hasInformation: false,
      currency: 'PEN',
    });

    expect(fileName).toBe('LE2010007097020260300080100001011.txt');
  });

  it('debe rechazar con BadRequestException si el RUC no tiene 11 dígitos numéricos', () => {
    expect(() =>
      PleFileNameRule.generate({
        ruc: '2010007097',
        year: 2026,
        month: 3,
        bookCode: '140100',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      PleFileNameRule.generate({
        ruc: '201000709701',
        year: 2026,
        month: 3,
        bookCode: '140100',
      }),
    ).toThrow(BadRequestException);
  });
});
