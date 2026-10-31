/**
 * TA-28 - Estados del pipeline: EN_COLA y OBSERVADO.
 *
 * El defecto que se corrige aqui: un CDR con codigo 2xxx-3999 es un RECHAZO y
 * uno con codigo >= 4000 es una OBSERVACION. Hasta ahora la observacion se
 * guardaba como ACEPTADO, asi que el comprobante quedaba indistinguible de una
 * aceptacion limpia en la consola fiscal y en el reporte SIRE.
 *
 * EN_COLA cubre el otro extremo: el comprobante encolado que el Circuit Breaker
 * retuvo sin tocar SUNAT no debe confundirse con uno que fallo.
 */
import { describe, expect, it } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { classifyResponseCode } from '../../../src/modules/sunat/soap/cdr-classifier';

describe('TA-28 clasificacion de codigos CDR', () => {
  // `classifyResponseCode` recibe SOLO el codigo: la descripcion la resuelve
  // internamente con `describeSunatCode`. Pasarle un segundo argumento no
  // compilaba (TS2554) aunque Jest lo ignorara en tiempo de ejecucion.
  it('un CDR 0 es aceptacion limpia', () => {
    const r = classifyResponseCode('0');
    expect(r.status).toBe(InvoiceStatus.ACEPTADO);
    expect(r.kind).toBe('ACEPTADO');
  });

  it('un CDR de observacion queda en OBSERVADO, no en ACEPTADO', () => {
    const r = classifyResponseCode('4000');
    expect(r.status).toBe(InvoiceStatus.OBSERVADO);
    expect(r.kind).toBe('OBSERVACION');
  });

  it('una observacion sigue siendo un comprobante valido y no reintentable', () => {
    const r = classifyResponseCode('4120');
    expect(r.valido).toBe(true);
    expect(r.reintentable).toBe(false);
  });

  it('un codigo 4100 tambien es observacion', () => {
    expect(classifyResponseCode('4100').status).toBe(InvoiceStatus.OBSERVADO);
  });

  it('un codigo 2000-3999 sigue siendo rechazo', () => {
    expect(classifyResponseCode('2017').status).toBe(InvoiceStatus.RECHAZADO);
    expect(classifyResponseCode('3999').status).toBe(InvoiceStatus.RECHAZADO);
  });

  it('el enum incluye EN_COLA y OBSERVADO tras la migracion', () => {
    expect(InvoiceStatus.EN_COLA).toBe('EN_COLA');
    expect(InvoiceStatus.OBSERVADO).toBe('OBSERVADO');
  });

  it('EN_COLA es un estado no terminal: no es el mismo que ERROR_RED', () => {
    const estados = Object.values(InvoiceStatus) as string[];
    expect(estados).toContain('EN_COLA');
    expect(estados.indexOf('EN_COLA')).toBeLessThan(
      estados.indexOf('ERROR_RED'),
    );
  });
});
