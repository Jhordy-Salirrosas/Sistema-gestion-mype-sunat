import { IsSerieValidConstraint } from './is-serie-valid.decorator';
import { ValidationArguments } from 'class-validator';

describe('IsSerieValidConstraint', () => {
  let validator: IsSerieValidConstraint;

  beforeEach(() => {
    validator = new IsSerieValidConstraint();
  });

  // Utilidad para simular el argumento que envía class-validator
  const mockArgs = (tipoComprobante: string): ValidationArguments => {
    return {
      object: { tipo_comprobante: tipoComprobante },
      value: undefined,
      targetName: '',
      property: 'serie',
      constraints: []
    };
  };

  it('debería retornar false si la serie no es un string', () => {
    expect(validator.validate(1234, mockArgs('01'))).toBe(false);
  });

  it('debería retornar false si no se provee el tipo_comprobante en el payload', () => {
    expect(validator.validate('F001', mockArgs(undefined as any))).toBe(false);
  });

  describe('Cuando es Factura (tipo_comprobante: 01)', () => {
    const args = mockArgs('01');

    it('debería retornar true para una serie propia (FXXX)', () => {
      expect(validator.validate('F001', args)).toBe(true);
      expect(validator.validate('F999', args)).toBe(true);
    });

    it('debería retornar true para una serie de Portal SUNAT (EXXX)', () => {
      expect(validator.validate('E001', args)).toBe(true);
    });

    it('debería retornar false para formatos incorrectos', () => {
      expect(validator.validate('B001', args)).toBe(false); // Es boleta
      expect(validator.validate('F01', args)).toBe(false);  // Faltan caracteres
      expect(validator.validate('F0001', args)).toBe(false); // Sobran caracteres
      expect(validator.validate('f001', args)).toBe(false); // F minúscula
    });
  });

  describe('Cuando es Boleta (tipo_comprobante: 03)', () => {
    const args = mockArgs('03');

    it('debería retornar true para una serie propia (BXXX)', () => {
      expect(validator.validate('B001', args)).toBe(true);
      expect(validator.validate('B999', args)).toBe(true);
    });

    it('debería retornar true para una serie de Portal SUNAT (EBXX)', () => {
      expect(validator.validate('EB01', args)).toBe(true);
    });

    it('debería retornar false para formatos incorrectos', () => {
      expect(validator.validate('F001', args)).toBe(false); // Es factura
      expect(validator.validate('E001', args)).toBe(false); // Es factura portal
      expect(validator.validate('B01', args)).toBe(false);  // Faltan caracteres
      expect(validator.validate('b001', args)).toBe(false); // b minúscula
    });
  });
});
