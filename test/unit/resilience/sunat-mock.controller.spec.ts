import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import AdmZip = require('adm-zip');
import { randomUUID } from 'node:crypto';
import { SunatMockModule } from '../../../src/modules/resilience/infrastructure/mock/sunatMockModule';
import {
  FAULT_RUC_BY_MODE,
  SLOW_MS_ENV_VAR,
  SunatFaultMode,
  TIMEOUT_MS_ENV_VAR,
} from '../../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures';

/** ZIP minimo valido en Base64, para el parametro contentFile del contrato. */
const CONTENT_FILE_BASE64 = 'UEsDBAoAAAAAAAAAIQAAAAAAAAAAAAAAAAAFAAAAdGVzdA==';

/** RUC valido (Modulo 11) usado para los casos de aceptacion. */
const RUC = '20123456786';

/** Latencia reducida para las pruebas de demora: no se esperan segundos. */
const TEST_LATENCY_MS = 60;

/**
 * Construye un sobre SOAP 1.1 con los dos parametros que exige el contrato de
 * sendBill: fileName (con el RUC emisor en los 11 primeros caracteres) y
 * contentFile (el ZIP del comprobante en Base64).
 *
 * Los cuerpos deben llevar ambos parametros: el controller valida el contrato y
 * responde 500 con SOAP Fault si falta alguno.
 */
function buildEnvelope(fileName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe">
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${fileName}</fileName>
      <contentFile>${CONTENT_FILE_BASE64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Extrae y decodifica el CDR del ZIP devuelto por el Mock. */
function extraerCdr(xmlResponse: string): string {
  const base64Match = xmlResponse.match(
    /<applicationResponse>(.*?)<\/applicationResponse>/,
  );
  if (!base64Match) {
    throw new Error('La respuesta no contiene applicationResponse');
  }
  const zip = new AdmZip(Buffer.from(base64Match[1], 'base64'));
  return zip.getEntries()[0].getData().toString('utf8');
}

describe('SunatMockController (e2e test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SunatMockModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(() => {
    delete process.env[TIMEOUT_MS_ENV_VAR];
    delete process.env[SLOW_MS_ENV_VAR];
  });

  // ---------------------------------------------------------------------------
  // Casos de aceptacion: cuatro tipos de comprobante devuelven CDR con codigo 0.
  // ---------------------------------------------------------------------------
  const comprobantes = [
    { tipo: 'Factura', tipoDoc: '01' },
    { tipo: 'Boleta', tipoDoc: '03' },
    { tipo: 'Nota de Crédito', tipoDoc: '07' },
    { tipo: 'Nota de Débito', tipoDoc: '08' },
  ];

  it.each(comprobantes)(
    'Debe aceptar una $tipo y devolver un CDR con código 0',
    async ({ tipoDoc }) => {
      const fileName = `${RUC}-${tipoDoc}-F001-${randomUUID()}.zip`;

      const response = await request(app.getHttpServer())
        .post('/sunat-mock/billService')
        .set('Content-Type', 'text/xml')
        .send(buildEnvelope(fileName))
        .expect(200);

      expect(extraerCdr(response.text)).toContain(
        '<cbc:ResponseCode>0</cbc:ResponseCode>',
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Modos explicitos por header (TA-14).
  // ---------------------------------------------------------------------------
  it('Debe devolver HTTP 200 con CDR de rechazo (código 2324) en modo REJECT', async () => {
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .set('x-mock-mode', 'REJECT')
      .set('x-mock-code', '2324')
      .send('<soapenv:Envelope>...FacturaRechazo...</soapenv:Envelope>')
      .expect(200);

    const cdr = extraerCdr(response.text);
    expect(cdr).toContain('<cbc:ResponseCode>2324</cbc:ResponseCode>');
    expect(cdr).toContain('rechazado con codigo 2324');
  });

  it('Debe devolver HTTP 500 con estructura SOAP Fault en modo FAULT', async () => {
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .set('x-mock-mode', 'FAULT')
      .send('<soapenv:Envelope>...FacturaInvalida...</soapenv:Envelope>')
      .expect(500);

    expect(response.text).toContain('<S:Fault>');
    expect(response.text).toContain('<faultcode>S:Client.0100</faultcode>');
    expect(response.text).toContain(
      'El comprobante no cumple con la estructura XML SOAP',
    );
  });

  // ---------------------------------------------------------------------------
  // Inyeccion de fallos por RUC (TA-12).
  // ---------------------------------------------------------------------------
  it('Debe devolver HTTP 503 cuando el RUC activa el modo SERVICE_UNAVAILABLE', async () => {
    const ruc = FAULT_RUC_BY_MODE[SunatFaultMode.SERVICE_UNAVAILABLE];

    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .send(buildEnvelope(`${ruc}-01-F001-1.zip`))
      .expect(503);

    expect(response.text).toContain('Fault');
  });

  it('Debe devolver HTTP 500 con SOAP Fault cuando el RUC activa SOAP_FAULT', async () => {
    const ruc = FAULT_RUC_BY_MODE[SunatFaultMode.SOAP_FAULT];

    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .send(buildEnvelope(`${ruc}-01-F001-1.zip`))
      .expect(500);

    expect(response.text).toContain('<faultcode>');
  });

  it('Debe demorar la respuesta cuando el RUC activa TIMEOUT', async () => {
    process.env[TIMEOUT_MS_ENV_VAR] = String(TEST_LATENCY_MS);
    const ruc = FAULT_RUC_BY_MODE[SunatFaultMode.TIMEOUT];

    const inicio = Date.now();
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .send(buildEnvelope(`${ruc}-01-F001-1.zip`))
      .expect(200);
    const transcurrido = Date.now() - inicio;

    expect(transcurrido).toBeGreaterThanOrEqual(TEST_LATENCY_MS - 10);
    // Tras la demora devuelve un CDR correcto, como una SUNAT lenta.
    expect(extraerCdr(response.text)).toContain(
      '<cbc:ResponseCode>0</cbc:ResponseCode>',
    );
  });

  it('Debe demorar la latencia configurada cuando el RUC activa SLOW', async () => {
    process.env[SLOW_MS_ENV_VAR] = String(TEST_LATENCY_MS);
    const ruc = FAULT_RUC_BY_MODE[SunatFaultMode.SLOW];

    const inicio = Date.now();
    await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .send(buildEnvelope(`${ruc}-01-F001-1.zip`))
      .expect(200);
    const transcurrido = Date.now() - inicio;

    expect(transcurrido).toBeGreaterThanOrEqual(TEST_LATENCY_MS - 10);
  });
});
