import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../../../src/database/prismaService';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import { SUNAT_BILL_SERVICE_URLS } from '../../../src/modules/sunat/soap/soap.constants';
import { resolveEndpoint } from '../../../src/modules/sunat/soap/sunatBillTypes';
import { SunatSoapClient } from '../../../src/modules/sunat/soap/sunat-soap.client';
import { parseCdrXml } from '../../../src/modules/sunat/soap/cdr.parser';
import { createBetaInvoicePayload, requiredEnv } from './sunatBetaTestSupport';

jest.setTimeout(120_000);

const betaDescribe =
  process.env.RUN_SUNAT_BETA_INTEGRATION === 'true' ? describe : describe.skip;

betaDescribe('TA-22 - conexión real opt-in al billService Beta', () => {
  it('envía una factura firmada, persiste el CDR y registra evidencia sin exponer credenciales', async () => {
    const endpoint = resolveEndpoint();
    if (endpoint !== SUNAT_BILL_SERVICE_URLS.beta) {
      throw new Error(
        `El test solo permite el endpoint Beta oficial: ${SUNAT_BILL_SERVICE_URLS.beta}`,
      );
    }

    const invoiceId = requiredEnv('SUNAT_BETA_INVOICE_ID');
    const databaseUrl = requiredEnv('SUNAT_BETA_DATABASE_URL');
    const payload = createBetaInvoicePayload();
    const client = new SunatSoapClient({ endpoint });
    console.info('[TA-22] Endpoint:', endpoint);
    console.info(
      '[TA-22] Payload sendBill:',
      JSON.stringify({
        fileName: payload.fileName,
        xmlBytes: Buffer.byteLength(payload.xml, 'utf8'),
        zipBytes: payload.zip.length,
        zipSha256: createHash('sha256').update(payload.zip).digest('hex'),
        signedInvoiceXml: payload.xml,
      }),
    );

    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;
    const prisma = new PrismaService();
    try {
      await prisma.$connect();
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          ruc_emisor: true,
          tipo_comprobante: true,
          serie: true,
          correlativo: true,
          cdr_sunat: true,
        },
      });
      if (
        !invoice ||
        invoice.ruc_emisor !== payload.ruc ||
        invoice.tipo_comprobante !== '01' ||
        invoice.serie !== payload.serie ||
        invoice.correlativo !== payload.correlativo
      ) {
        throw new Error(
          'SUNAT_BETA_INVOICE_ID debe identificar la factura con el mismo RUC y numeración',
        );
      }
      if (invoice.cdr_sunat) {
        throw new Error(
          'La factura de prueba ya tiene un CDR; no se enviará de nuevo',
        );
      }

      const service = SunatBillService.create(
        new CdrPersistenceService(prisma),
        client,
      );
      const result = await service.sendAndProcess({
        invoiceId,
        rucEmisor: payload.ruc,
        tipoComprobante: '01',
        serie: payload.serie,
        correlativo: payload.correlativo,
        zip: payload.zip,
      });
      console.info('[TA-22] CDR recibido:', JSON.stringify(result.cdr));

      const fixture = parseCdrXml(
        readFileSync(
          join(process.cwd(), 'fixtures', 'sunat-cdr', 'aceptado.xml'),
          'utf8',
        ),
      );
      expect(result.error).toBeNull();
      expect(result.responseCode).toBe('0');
      expect(result.cdr?.description).toBeTruthy();
      expect(result.cdr?.referenceId).toBe(
        `${payload.serie}-${String(payload.correlativo).padStart(8, '0')}`,
      );
      expect(result.cdr?.referenceId).toBe(
        `${payload.serie}-${String(payload.correlativo).padStart(8, '0')}`,
      );
      expect(Object.keys(result.cdr ?? {}).sort()).toEqual(
        Object.keys(fixture).sort(),
      );
      expect(result.cdr?.responseCode).toBe(fixture.responseCode);
      expect(result.cdr?.rawXml).toMatch(
        /<(?:\w+:)?ResponseCode\b[^>]*>0<\/(?:\w+:)?ResponseCode>/,
      );
      expect(result.cdr?.rawXml).toMatch(/<(?:\w+:)?Description\b/);
      const persisted = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { cdr_sunat: true },
      });
      expect(persisted?.cdr_sunat).toMatchObject({ responseCode: '0' });
    } finally {
      try {
        await prisma.$disconnect();
      } finally {
        if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
