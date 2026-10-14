import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import AdmZip = require('adm-zip');
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../../src/appModule';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

/** ZIP minimo valido en Base64, para el parametro contentFile del contrato. */
const CONTENT_FILE_BASE64 = 'UEsDBAoAAAAAAAAAIQAAAAAAAAAAAAAAAAAFAAAAdGVzdA==';

/** RUC valido (Modulo 11) usado para los casos de aceptacion. */
const RUC = '20123456786';

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

      expect(cdrContent).toContain('<cbc:ResponseCode>0</cbc:ResponseCode>');
    },
  );
});
