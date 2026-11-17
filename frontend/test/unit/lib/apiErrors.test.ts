import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage, getApiErrorStatus, getApiRetryAfterMs, RATE_LIMIT_MESSAGE } from '@/lib/apiErrors';

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

it('expone el estado HTTP y prioriza 429 sobre un mensaje de credenciales del backend', () => {
  const error = { response: { status: 429, data: { message: 'Credenciales de acceso incorrectas' } } };
  expect(getApiErrorStatus(error)).toBe(429);
  expect(getApiErrorStatus(new Error('red'))).toBeUndefined();
  expect(extractApiErrorMessage(error, 'Credenciales de acceso incorrectas')).toBe(RATE_LIMIT_MESSAGE);
});
it.each([undefined, {}, { 'retry-after': 'invalid' }, { 'retry-after': '-1' }])('Retry-After ausente o inválido usa 60 s: %j', headers => {
  expect(getApiRetryAfterMs({ response: { headers } })).toBe(60_000);
});
it('interpreta segundos, fecha HTTP y AxiosHeaders sin espera inmediata', () => {
  const now = Date.parse('2026-11-17T15:00:00Z');
  expect(getApiRetryAfterMs({ response: { headers: { get: () => '90' } } }, now)).toBe(90_000);
  expect(getApiRetryAfterMs({ response: { headers: { 'Retry-After': 'Tue, 17 Nov 2026 15:02:00 GMT' } } }, now)).toBe(120_000);
  expect(getApiRetryAfterMs({ response: { headers: { 'retry-after': '0' } } }, now)).toBe(1000);
});
