import { RucVo } from '../../../src/modules/auth/domain/value-objects/rucVo';

describe('RucVo', () => {
  it('debería instanciar un RUC válido que cumple Módulo 11', () => {
    const ruc = RucVo.create('20100070970');
    expect(ruc.getValue()).toBe('20100070970');
  });

  it('debería rechazar un RUC con longitud menor a 11 caracteres', () => {
    expect(() => RucVo.create('2010007097')).toThrow(
      'El RUC debe contener exactamente 11 dígitos numéricos.',
    );
  });

  it('debería rechazar un RUC con letras o caracteres no numéricos', () => {
    expect(() => RucVo.create('2010007097A')).toThrow(
      'El RUC debe contener exactamente 11 dígitos numéricos.',
    );
  });

  it('debería rechazar un prefijo de RUC no reconocido por SUNAT', () => {
    expect(() => RucVo.create('30100070970')).toThrow(
      'Prefijo de RUC inválido: 30',
    );
  });

  it('debería rechazar un RUC que no cumple el algoritmo Módulo 11', () => {
    expect(() => RucVo.create('20100070971')).toThrow(
      'El RUC no supera la validación matemática Módulo 11 de SUNAT.',
    );
  });
});
