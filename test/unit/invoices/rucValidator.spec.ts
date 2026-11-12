import { IsRucValidConstraint } from '../../../src/modules/invoices/application/validators/isRucValidDecorator';

const validador = new IsRucValidConstraint();

describe('IsRucValidConstraint', () => {
  it('acepta RUC con prefijo y módulo 11 válidos', () => {
    expect(validador.validate('20100070970', {} as never)).toBe(true);
    expect(validador.validate('10456789123', {} as never)).toBe(false); // módulo inválido
  });

  it('rechaza prefijos no tributarios', () => {
    expect(validador.validate('30100070970', {} as never)).toBe(false);
    expect(validador.validate('99100070970', {} as never)).toBe(false);
  });
});
