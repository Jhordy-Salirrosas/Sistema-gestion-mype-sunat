/**
 * TA-69 · contrato de alertas operativas en el front.
 *
 * Lo que se protege: que un campo que no llega NO se convierta en una cifra
 * falsa en pantalla. Un `undefined` en `formatCurrency` pinta "NaN" y un
 * backend que responde `{}` no debe verse como "todo en orden".
 */
import { describe, expect, it } from 'vitest';
import {
  ALERTAS_VACIAS,
  esGravedad,
  gravedadMaxima,
  normalizarAlertas,
} from '@/modules/invoices/lib/invoiceAlertas';

describe('TA-69 · normalizar alertas en el front', () => {
  it('traduce una respuesta completa', () => {
    const r = normalizarAlertas({
      certificado: {
        evaluado: true,
        diasRestantes: 12,
        venceEl: '2026-11-12T00:00:00.000Z',
        gravedad: 'AVISO',
        mensaje: 'vence pronto',
      },
      dlq: {
        evaluado: true,
        pendientes: 3,
        gravedad: 'CRITICO',
        mensaje: '3 trabados',
      },
      gravedadGlobal: 'CRITICO',
      consultadoEl: '2026-10-31T20:00:00.000Z',
    });

    expect(r.certificado.diasRestantes).toBe(12);
    expect(r.dlq.pendientes).toBe(3);
    expect(r.gravedadGlobal).toBe('CRITICO');
  });

  it('trata una respuesta vacía como "sin datos" y no como verde', () => {
    const r = normalizarAlertas({});
    expect(r.certificado.gravedad).toBe('SIN_DATOS');
    expect(r.dlq.gravedad).toBe('SIN_DATOS');
    expect(r.gravedadGlobal).toBe('SIN_DATOS');
  });

  it('no deja pasar undefined a la pantalla', () => {
    const r = normalizarAlertas(null);
    expect(r.certificado.diasRestantes).toBeNull();
    expect(r.dlq.pendientes).toBe(0);
    expect(typeof r.certificado.mensaje).toBe('string');
    expect(typeof r.dlq.mensaje).toBe('string');
  });

  it('recalcula la gravedad global sobre lo ya normalizado', () => {
    // El backend dice OK, pero la DLQ trae 5 trabados: la global no puede ser OK.
    const r = normalizarAlertas({
      certificado: {
        evaluado: true,
        diasRestantes: 200,
        venceEl: '2027-05-19T00:00:00.000Z',
        gravedad: 'OK',
        mensaje: 'ok',
      },
      dlq: { evaluado: true, pendientes: 5, gravedad: 'CRITICO', mensaje: '5' },
      gravedadGlobal: 'OK',
    });

    expect(r.gravedadGlobal).toBe('CRITICO');
  });

  it('descarta una gravedad inventada', () => {
    const r = normalizarAlertas({
      certificado: {
        evaluado: true,
        diasRestantes: null,
        venceEl: null,
        gravedad: 'REGULAR' as never,
        mensaje: 'x',
      },
    });
    expect(r.certificado.gravedad).toBe('SIN_DATOS');
  });

  it('reconoce las gravedades válidas', () => {
    expect(esGravedad('OK')).toBe(true);
    expect(esGravedad('AVISO')).toBe(true);
    expect(esGravedad('CRITICO')).toBe(true);
    expect(esGravedad('SIN_DATOS')).toBe(true);
    expect(esGravedad('otra')).toBe(false);
    expect(esGravedad(7)).toBe(false);
  });

  it('ordena la gravedad: CRITICO pesa más que AVISO y que SIN_DATOS', () => {
    expect(gravedadMaxima(['OK', 'AVISO'])).toBe('AVISO');
    expect(gravedadMaxima(['OK', 'SIN_DATOS'])).toBe('SIN_DATOS');
    expect(gravedadMaxima(['AVISO', 'CRITICO'])).toBe('CRITICO');
    expect(gravedadMaxima([])).toBe('OK');
  });

  it('expone valores neutros antes de la primera respuesta', () => {
    expect(ALERTAS_VACIAS.certificado.gravedad).toBe('SIN_DATOS');
    expect(ALERTAS_VACIAS.dlq.pendientes).toBe(0);
  });
});
