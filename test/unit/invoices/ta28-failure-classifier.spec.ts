/**
 * TA-28 - Clasificacion de fallos del pipeline y backoff.
 *
 * Estos tests fijan la regla central que el worker no tenia: distinguir entre
 * fallo transitorio (reintentar), definitivo (cortar) e incierto (consultar
 * el estado antes de reenviar).
 */
import {
  calcularBackoffMs,
  clasificarFallo,
} from '../../../src/modules/invoices/invoiceFailureClassifier';
import { SunatTransportError } from '../../../src/modules/sunat/soap/sunat-soap.client';
import { SunatSoapFaultError } from '../../../src/modules/sunat/soap/soap-envelope';

describe('TA-28 clasificarFallo', () => {
  it('trata un SOAP Fault como DEFINITIVO, aunque llegue con HTTP 500', () => {
    const fault = new SunatSoapFaultError({
      faultCode: 'soap-env:Server',
      faultString: '0102 Usuario o contrasena incorrectos',
    });

    const r = clasificarFallo(fault);

    expect(r.clase).toBe('DEFINITIVO');
    expect(r.reintentable).toBe(false);
    expect(r.codigo).toBe('0102');
  });

  it('trata un HTTP 503 como TRANSIENTE y reintentable', () => {
    const error = new SunatTransportError('El billService respondio HTTP 503', {
      httpStatus: 503,
    });

    const r = clasificarFallo(error);

    expect(r.clase).toBe('TRANSIENTE');
    expect(r.reintentable).toBe(true);
    expect(r.codigo).toBe('HTTP_503');
  });

  it('trata un timeout como INCIERTO: hay que consultar el estado', () => {
    const error = new SunatTransportError(
      'Timeout de 30000 ms esperando al billService. El comprobante quedo en estado incierto: NO reenviar a ciegas',
    );

    const r = clasificarFallo(error);

    expect(r.clase).toBe('INCIERTO');
    expect(r.requiereConsultaEstado).toBe(true);
    expect(r.reintentable).toBe(false);
    expect(r.codigo).toBe('SOAP_TIMEOUT');
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'])(
    'trata %s como TRANSIENTE (el sobre no salio)',
    (code) => {
      const r = clasificarFallo(Object.assign(new Error('fallo de red'), { code }));

      expect(r.clase).toBe('TRANSIENTE');
      expect(r.reintentable).toBe(true);
      expect(r.codigo).toBe(code);
    },
  );

  it.each(['ETIMEDOUT', 'ESOCKETTIMEDOUT'])(
    'trata %s como INCIERTO (el sobre pudo haber salido)',
    (code) => {
      const r = clasificarFallo(Object.assign(new Error('timeout'), { code }));

      expect(r.clase).toBe('INCIERTO');
      expect(r.requiereConsultaEstado).toBe(true);
    },
  );

  it('trata un fallo de validacion XSD como DEFINITIVO', () => {
    const r = clasificarFallo(
      new Error('Rechazado por XSD: falta cbc:ID en Invoice'),
    );

    expect(r.clase).toBe('DEFINITIVO');
    expect(r.reintentable).toBe(false);
    expect(r.codigo).toBe('ERR_PIPELINE');
  });

  it('trata un error desconocido como DEFINITIVO para no duplicar envios', () => {
    const r = clasificarFallo(new Error('algo raro paso'));

    expect(r.clase).toBe('DEFINITIVO');
    expect(r.reintentable).toBe(false);
    expect(r.codigo).toBe('ERR_DESCONOCIDO');
  });

  it('no rompe con valores que no son Error', () => {
    expect(clasificarFallo('texto suelto').clase).toBe('DEFINITIVO');
    expect(clasificarFallo(null).clase).toBe('DEFINITIVO');
  });
});

describe('TA-28 calcularBackoffMs', () => {
  it('crece exponencialmente: t_k = base * 2^(k-1)', () => {
    expect(calcularBackoffMs(1, 500)).toBe(500);
    expect(calcularBackoffMs(2, 500)).toBe(1000);
    expect(calcularBackoffMs(3, 500)).toBe(2000);
  });

  it('respeta el techo configurado', () => {
    expect(calcularBackoffMs(10, 500, 8000)).toBe(8000);
  });

  it('nunca devuelve un valor negativo ni cero para intentos invalidos', () => {
    expect(calcularBackoffMs(0, 500)).toBe(500);
    expect(calcularBackoffMs(-5, 500)).toBe(500);
  });
});
