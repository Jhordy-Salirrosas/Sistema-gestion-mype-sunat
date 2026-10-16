import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import AdmZip = require('adm-zip');
import { SunatMockModule } from '../../../src/modules/resilience/infrastructure/mock/sunatMockModule';

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

  const comprobantes = [
    { tipo: 'Factura', body: '<soapenv:Envelope>...Factura...</soapenv:Envelope>' },
    { tipo: 'Boleta', body: '<soapenv:Envelope>...Boleta...</soapenv:Envelope>' },
    { tipo: 'Nota de Crédito', body: '<soapenv:Envelope>...NotaCredito...</soapenv:Envelope>' },
    { tipo: 'Nota de Débito', body: '<soapenv:Envelope>...NotaDebito...</soapenv:Envelope>' },
  ];

  it.each(comprobantes)(
    'Debe aceptar una $tipo y devolver un CDR con código 0',
    async ({ body }) => {
      const response = await request(app.getHttpServer())
        .post('/sunat-mock/billService')
        .set('Content-Type', 'text/xml')
        .send(body)
        .expect(200);

      const xmlResponse = response.text;
      const base64Match = xmlResponse.match(
        /<applicationResponse>(.*?)<\/applicationResponse>/,
      );

      expect(base64Match).toBeDefined();

      const zipBuffer = Buffer.from(base64Match![1], 'base64');
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      expect(zipEntries.length).toBe(1);

      const cdrContent = zipEntries[0].getData().toString('utf8');

      expect(cdrContent).toContain(
        '<cbc:ResponseCode>0</cbc:ResponseCode>',
      );
    },
  );

  it('Debe devolver HTTP 200 con CDR de rechazo (código 2324) en modo REJECT', async () => {
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .set('x-mock-mode', 'REJECT')
      .set('x-mock-code', '2324')
      .send('<soapenv:Envelope>...FacturaRechazo...</soapenv:Envelope>')
      .expect(200);

    const xmlResponse = response.text;
    const base64Match = xmlResponse.match(
      /<applicationResponse>(.*?)<\/applicationResponse>/,
    );
    expect(base64Match).toBeDefined();

    const zipBuffer = Buffer.from(base64Match![1], 'base64');
    const zip = new AdmZip(zipBuffer);
    const cdrContent = zip.getEntries()[0].getData().toString('utf8');

    expect(cdrContent).toContain('<cbc:ResponseCode>2324</cbc:ResponseCode>');
    expect(cdrContent).toContain('rechazado con codigo 2324');
  });

  it('Debe devolver HTTP 500 con estructura SOAP Fault en modo FAULT', async () => {
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .set('x-mock-mode', 'FAULT')
      .send('<soapenv:Envelope>...FacturaInvalida...</soapenv:Envelope>')
      .expect(500);

    const xmlResponse = response.text;
    expect(xmlResponse).toContain('<S:Fault>');
    expect(xmlResponse).toContain('<faultcode>S:Client.0100</faultcode>');
    expect(xmlResponse).toContain('El comprobante no cumple con la estructura XML SOAP');
  });
});