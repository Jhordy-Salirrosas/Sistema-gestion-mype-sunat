import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import AdmZip = require('adm-zip');
import { AppModule } from '../../app.module';
import { QueueService } from '../queue/queue.service';

describe('SunatMockController (e2e test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useValue({
        enqueueInvoiceInTx: jest.fn().mockResolvedValue('job-test-001'),
      })
      .compile();

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
});

