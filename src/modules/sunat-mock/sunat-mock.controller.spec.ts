import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import AdmZip = require('adm-zip');
import { AppModule } from '../../app.module';

describe('SunatMockController (e2e test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const comprobantes = [
    { tipo: 'Factura', body: '<soapenv:Envelope>...Factura...</soapenv:Envelope>' },
    { tipo: 'Boleta', body: '<soapenv:Envelope>...Boleta...</soapenv:Envelope>' },
    { tipo: 'Nota de Crédito', body: '<soapenv:Envelope>...NotaCredito...</soapenv:Envelope>' },
    { tipo: 'Nota de Débito', body: '<soapenv:Envelope>...NotaDebito...</soapenv:Envelope>' },
  ];

  it.each(comprobantes)('Debe aceptar una $tipo y devolver un CDR con código 0', async ({ body }) => {
    const response = await request(app.getHttpServer())
      .post('/sunat-mock/billService')
      .set('Content-Type', 'text/xml')
      .send(body)
      .expect(200);

    // 1. Extraer el Base64 de la respuesta XML
    const xmlResponse = response.text;
    const base64Match = xmlResponse.match(/<applicationResponse>(.*?)<\/applicationResponse>/);
    expect(base64Match).toBeDefined();
    
    const zipBase64 = base64Match![1];

    // 2. Decodificar el Base64 y leer el ZIP en memoria
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    expect(zipEntries.length).toBe(1); // Debe contener 1 archivo XML

    // 3. Leer el contenido del archivo XML extraído
    const cdrContent = zipEntries[0].getData().toString('utf8');

    // 4. Verificar que el CDR contiene el código de respuesta 0 (Aceptado)
    expect(cdrContent).toContain('<cbc:ResponseCode>0</cbc:ResponseCode>');
  });
});
