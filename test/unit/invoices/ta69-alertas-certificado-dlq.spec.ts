/**
 * TA-69: alertas de certificado y de cola de muertos.
 *
 * Lo que se comprueba aquí no es que la cifra esté, sino los BORDES: 7 y 8
 * días, 30 y 31 días, cero y negativo. Un certificado que vence mañana y otro
 * que vence en seis días deben pintarse distinto, porque el primero obliga a
 * actuar hoy.
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  gravedadCertificado,
  gravedadMaxima,
  mensajeCertificado,
  mensajeDlq,
  InvoiceAlertService,
  UMBRAL_CERTIFICADO_CRITICO_DIAS,
  UMBRAL_CERTIFICADO_DIAS,
} from '../../../src/modules/invoices/application/services/invoiceAlertService';

describe('TA-69 gravedad del certificado', () => {
  it('marca CRITICO cuando ya venció o vence hoy', () => {
    expect(gravedadCertificado(0)).toBe('CRITICO');
    expect(gravedadCertificado(-3)).toBe('CRITICO');
  });

  it('marca CRITICO hasta el umbral de 7 días', () => {
    expect(gravedadCertificado(1)).toBe('CRITICO');
    expect(gravedadCertificado(UMBRAL_CERTIFICADO_CRITICO_DIAS)).toBe('CRITICO');
  });

  it('marca AVISO desde el día 8 hasta el 30', () => {
    expect(gravedadCertificado(UMBRAL_CERTIFICADO_CRITICO_DIAS + 1)).toBe('AVISO');
    expect(gravedadCertificado(UMBRAL_CERTIFICADO_DIAS)).toBe('AVISO');
  });

  it('marca OK desde el día 31', () => {
    expect(gravedadCertificado(UMBRAL_CERTIFICADO_DIAS + 1)).toBe('OK');
    expect(gravedadCertificado(365)).toBe('OK');
  });

  it('dice la fecha de vencimiento dentro del mensaje', () => {
    const vence = new Date('2026-11-20T00:00:00.000Z');
    expect(mensajeCertificado(7, vence)).toContain('2026-11-20');
    expect(mensajeCertificado(7, vence)).toContain('7 día');
  });

  it('no promete vigencia cuando ya venció', () => {
    const pase = mensajeCertificado(0, new Date('2026-11-20T00:00:00.000Z'));
    expect(pase).toContain('venció');
    expect(pase).toContain('no se puede firmar');
  });
});

describe('TA-69 gravedad global', () => {
  it('toma la más alta de las dos alertas', () => {
    expect(gravedadMaxima(['OK', 'CRITICO'])).toBe('CRITICO');
    expect(gravedadMaxima(['CRITICO', 'AVISO'])).toBe('CRITICO');
    expect(gravedadMaxima(['OK', 'AVISO'])).toBe('AVISO');
    expect(gravedadMaxima(['OK', 'OK'])).toBe('OK');
  });

  it('no deja que "sin datos" se vea como un verde', () => {
    // Que no se pueda comprobar es mejor que un aviso real, pero peor que OK:
    // pintar verde por ausencia de dato es el falso positivo que se prohíbe.
    expect(gravedadMaxima(['OK', 'SIN_DATOS'])).toBe('SIN_DATOS');
    expect(gravedadMaxima(['SIN_DATOS', 'AVISO'])).toBe('AVISO');
    expect(gravedadMaxima([])).toBe('OK');
  });
});

describe('TA-69 mensaje de la DLQ', () => {
  it('informa cuando está vacía', () => {
    expect(mensajeDlq(0)).toContain('Sin comprobantes');
  });

  it('informa cuántos quedaron trabados', () => {
    const texto = mensajeDlq(4);
    expect(texto).toContain('4 comprobante');
    expect(texto).toContain('revisión manual');
  });
});

describe('TA-69 InvoiceAlertService', () => {
  const certificadoFalso = (diasRestantes: number, falla = false) => ({
    getCertificate: jest.fn(() => {
      if (falla) throw new Error('Falta la variable de entorno CERT_BASE64');
      return {
        certificatePem: 'pem',
        privateKeyPem: 'pem',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date(
          Date.now() + diasRestantes * 24 * 60 * 60 * 1000,
        ),
        issuerRuc: '20123456789',
        daysRemaining: diasRestantes,
      };
    }),
  });

  const colaFalsa = (pendientes: number, falla = false) => ({
    countDlq: jest.fn(async () => {
      if (falla) throw new Error('pg-boss caído');
      return pendientes;
    }),
    listDlq: jest.fn(),
  });

  it('expone los días restantes del certificado', () => {
    const servicio = new InvoiceAlertService(
      certificadoFalso(12) as never,
      colaFalsa(0) as never,
    );

    const alerta = servicio.estadoCertificado();
    expect(alerta.evaluado).toBe(true);
    expect(alerta.diasRestantes).toBe(12);
    expect(alerta.gravedad).toBe('AVISO');
  });

  it('no lanza cuando falta el certificado: devuelve SIN_DATOS', () => {
    const servicio = new InvoiceAlertService(
      certificadoFalso(0, true) as never,
      colaFalsa(0) as never,
    );

    const alerta = servicio.estadoCertificado();
    expect(alerta.evaluado).toBe(false);
    expect(alerta.gravedad).toBe('SIN_DATOS');
    expect(alerta.diasRestantes).toBeNull();
  });

  it('cuenta los comprobantes de la DLQ', async () => {
    const servicio = new InvoiceAlertService(
      certificadoFalso(100) as never,
      colaFalsa(3) as never,
    );

    const alerta = await servicio.estadoDlq('emp-1');
    expect(alerta.pendientes).toBe(3);
    expect(alerta.gravedad).toBe('CRITICO');
  });

  it('no tumba la respuesta si la cola no responde', async () => {
    const servicio = new InvoiceAlertService(
      certificadoFalso(100) as never,
      colaFalsa(0, true) as never,
    );

    const alerta = await servicio.estadoDlq('emp-1');
    expect(alerta.evaluado).toBe(false);
    expect(alerta.gravedad).toBe('SIN_DATOS');
  });

  it('junta las dos alertas y calcula la gravedad global', async () => {
    const servicio = new InvoiceAlertService(
      certificadoFalso(5) as never,
      colaFalsa(2) as never,
    );

    const estado = await servicio.estado('emp-1');
    expect(estado.certificado.gravedad).toBe('CRITICO');
    expect(estado.dlq.pendientes).toBe(2);
    expect(estado.gravedadGlobal).toBe('CRITICO');
    expect(typeof estado.consultadoEl).toBe('string');
  });
});
