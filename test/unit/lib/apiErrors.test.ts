import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage } from '@/lib/apiErrors';

describe('extractApiErrorMessage utility', () => {
  it('retorna el fallback cuando el error es nulo o indefinido', () => {
    expect(extractApiErrorMessage(null)).toBe('Ha ocurrido un error inesperado al procesar la solicitud.');
    expect(extractApiErrorMessage(undefined, 'Fallback custom')).toBe('Fallback custom');
  });

  it('retorna directamente si el error es una cadena simple', () => {
    expect(extractApiErrorMessage('Error de red temporal')).toBe('Error de red temporal');
  });

  it('extrae y une mensajes cuando backend devuelve un array [{ field, rule, message }]', () => {
    const errorFromBackend = {
      response: {
        data: {
          message: [
            { field: 'fob_value_usd', rule: 'isPositive', message: 'El valor FOB debe ser mayor a 0' },
            { field: 'customs_agency_code', rule: 'isLength', message: 'El código de aduana debe tener 3 dígitos' },
          ],
        },
      },
    };

    const result = extractApiErrorMessage(errorFromBackend);
    expect(result).toBe('El valor FOB debe ser mayor a 0 • El código de aduana debe tener 3 dígitos');
  });

  it('extrae mensaje cuando backend devuelve un objeto único { field, rule, message }', () => {
    const errorFromBackend = {
      response: {
        data: {
          message: {
            field: 'dua_number',
            rule: 'matches',
            message: 'El número de DUA/DAM debe cumplir el formato oficial',
          },
        },
      },
    };

    expect(extractApiErrorMessage(errorFromBackend)).toBe(
      'El número de DUA/DAM debe cumplir el formato oficial'
    );
  });

  it('soporta RFC 7807 problem details (detail e invalidParams)', () => {
    const problemDetailsError = {
      response: {
        data: {
          type: 'https://sync-sunat.pe/errors/bad-request',
          title: 'BadRequest',
          detail: 'Parámetros inválidos en la petición aduanera.',
        },
      },
    };

    expect(extractApiErrorMessage(problemDetailsError)).toBe(
      'Parámetros inválidos en la petición aduanera.'
    );
  });

  it('extrae mensaje de una instancia nativa Error', () => {
    const nativeError = new Error('Fallo de conexión local');
    expect(extractApiErrorMessage(nativeError)).toBe('Fallo de conexión local');
  });
});
