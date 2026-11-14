import { BadRequestException } from '@nestjs/common';
import {
  construirCar,
  descomponerCar,
  esCarValido,
  LONGITUD_CAR,
  MONEDA_CAR,
  PAR_RESERVADO,
  rucRecaudadorCar,
} from '../../../src/modules/sire/application/sireCarService';

describe('sireCarService', () => {
  describe('esCarValido', () => {
    it('acepta un CAR de 27 dígitos', () => {
      expect(esCarValido('1'.repeat(LONGITUD_CAR))).toBe(true);
    });

    it('rechaza un CAR con menos o más de 27 dígitos', () => {
      expect(esCarValido('1'.repeat(26))).toBe(false);
      expect(esCarValido('1'.repeat(28))).toBe(false);
      expect(esCarValido('')).toBe(false);
    });

    it('rechaza un CAR con letras', () => {
      expect(esCarValido(`${'1'.repeat(26)}A`)).toBe(false);
    });

    it('no lanza cuando el valor recibido es nulo o indefinido', () => {
      expect(esCarValido(undefined as unknown as string)).toBe(false);
      expect(esCarValido(null as unknown as string)).toBe(false);
    });
  });

  describe('rucRecaudadorCar', () => {
    it('toma los tres dígitos de la parte secuencial del RUC', () => {
      expect(rucRecaudadorCar('20100070970')).toBe('100');
      expect(rucRecaudadorCar('17930029666')).toBe('930');
    });

    it('ignora los caracteres no numéricos del RUC', () => {
      expect(rucRecaudadorCar('201-000-70970')).toBe('100');
    });

    it('rechaza un RUC que no tiene 11 dígitos', () => {
      expect(() => rucRecaudadorCar('2010007097')).toThrow(
        BadRequestException,
      );
      expect(() => rucRecaudadorCar('201000709700')).toThrow(
        BadRequestException,
      );
    });

    it('expone un código de error estable para el frontend', () => {
      expect.assertions(2);
      try {
        rucRecaudadorCar('123');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CAR_RECAUDADOR_INVALIDO',
        });
      }
    });
  });

  describe('construirCar', () => {
    const datos = {
      moneda: 'PEN',
      rucRecaudador: '20100070970',
      numeroOperacion: '12345',
    };

    it('arma un CAR de 27 dígitos con la anatomía esperada', () => {
      const car = construirCar(datos);

      expect(car).toHaveLength(LONGITUD_CAR);
      expect(esCarValido(car)).toBe(true);
      expect(car.startsWith(`${MONEDA_CAR['PEN']}${PAR_RESERVADO}1`)).toBe(true);
      expect(car.slice(4, 7)).toBe('100');
      expect(car.slice(7, 26)).toBe('0000000000000012345');
      expect(car.slice(26)).toBe('0');
    });

    it('acepta dólares con la misma anatomía', () => {
      const car = construirCar({ ...datos, moneda: 'USD' });

      expect(car.startsWith(MONEDA_CAR['USD'])).toBe(true);
    });

    it('normaliza la moneda a mayúsculas', () => {
      expect(construirCar({ ...datos, moneda: 'pen' })).toBe(
        construirCar({ ...datos, moneda: 'PEN' }),
      );
    });

    it('rellena con ceros a la izquierda el número de operación', () => {
      const car = construirCar({ ...datos, numeroOperacion: '7' });

      expect(car.slice(7, 26)).toBe('0000000000000000007');
    });

    it('descarta los caracteres no numéricos del número de operación', () => {
      const car = construirCar({ ...datos, numeroOperacion: 'OP-12345' });

      expect(car.slice(7, 26)).toBe('0000000000000012345');
    });

    it('rechaza una moneda que no admite CAR', () => {
      expect(() => construirCar({ ...datos, moneda: 'EUR' })).toThrow(
        BadRequestException,
      );
      expect.assertions(2);
      try {
        construirCar({ ...datos, moneda: 'EUR' });
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CAR_MONEDA_INVALIDA',
        });
      }
    });

    it('rechaza un tipo de operación que no está soportado', () => {
      expect.assertions(2);
      try {
        construirCar({ ...datos, tipoOperacion: '2' });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CAR_TIPO_OPERACION_INVALIDO',
        });
      }
    });

    it('rechaza un número de operación vacío', () => {
      expect.assertions(2);
      try {
        construirCar({ ...datos, numeroOperacion: '   ' });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CAR_OPERACION_VACIA',
        });
      }
    });

    it('rechaza un número de operación con más de 19 dígitos', () => {
      expect.assertions(2);
      try {
        construirCar({ ...datos, numeroOperacion: '1'.repeat(20) });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CAR_OPERACION_LARGA',
        });
      }
    });

    it('propaga el error del recaudador inválido', () => {
      expect(() =>
        construirCar({ ...datos, rucRecaudador: '123' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('descomponerCar', () => {
    it('devuelve las partes de un CAR válido', () => {
      const car = construirCar({
        moneda: 'PEN',
        rucRecaudador: '20100070970',
        numeroOperacion: '12345',
      });

      expect(descomponerCar(car)).toEqual({
        moneda: '1',
        parReservado: '00',
        tipoOperacion: '1',
        recaudador: '100',
        operacion: '0000000000000012345',
      });
    });

    it('devuelve null en lugar de lanzar cuando el código no es válido', () => {
      expect(descomponerCar('123')).toBeNull();
      expect(descomponerCar('')).toBeNull();
      expect(descomponerCar(undefined as unknown as string)).toBeNull();
    });
  });
});
