/**
 * HU-04 — política pura de backoff exponencial.
 *
 * Verifica los números de la historia: 3 reintentos con esperas de 5, 15 y
 * 45 segundos, y la separación entre fallos reintentables (red/timeout/5xx) y
 * los rechazos de negocio del CDR (que nunca se reintentan).
 */
import {
  BACKOFF_DELAYS_MS,
  decidirReintento,
  delayDelReintento,
  MAX_INTENTOS,
  MAX_REINTENTOS,
} from '../../../src/modules/resilience/domain/rules/backoffPolicy';

describe('HU-04 · backoffPolicy', () => {
  it('define 3 reintentos con retardos de 5 s, 15 s y 45 s', () => {
    expect(BACKOFF_DELAYS_MS).toEqual([5_000, 15_000, 45_000]);
    expect(MAX_REINTENTOS).toBe(3);
    expect(MAX_INTENTOS).toBe(4);
    expect(delayDelReintento(1)).toBe(5_000);
    expect(delayDelReintento(2)).toBe(15_000);
    expect(delayDelReintento(3)).toBe(45_000);
  });

  it('reintenta mientras queden intentos y manda a la DLQ al agotarlos', () => {
    expect(decidirReintento({ reintentable: true }, 1)).toBe('REINTENTAR');
    expect(decidirReintento({ reintentable: true }, 2)).toBe('REINTENTAR');
    expect(decidirReintento({ reintentable: true }, 3)).toBe('REINTENTAR');
    expect(decidirReintento({ reintentable: true }, 4)).toBe('DLQ');
  });

  it('no reintenta un rechazo de negocio del CDR', () => {
    expect(decidirReintento({ reintentable: false }, 1)).toBe('DETENER');
    expect(decidirReintento({ reintentable: false }, 4)).toBe('DETENER');
  });

  it('rechaza números de intento inválidos', () => {
    expect(() => delayDelReintento(0)).toThrow(RangeError);
    expect(() => delayDelReintento(-1)).toThrow(RangeError);
  });
});
