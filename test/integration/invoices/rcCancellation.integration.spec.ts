import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../../src/database/prismaService';
import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';
import { SummaryAggregateStore } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
import { hashSummary } from '../../../src/modules/invoices/application/services/summaryGate';
import { fechaFiscalLima } from '../../../src/modules/invoices/fiscalDate';
import { fiscal8d } from '../../fixtures/8dFiscalHarness';
const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('RC de anulación con PostgreSQL, transporte sustituido', () => {
 let db: PrismaService; let companyId: string; let originId: string; const ids: string[] = [];
 const originalDb = process.env.DATABASE_URL;
 const hoy = fechaFiscalLima(); const ruc = '20000000001';
 beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl; db = new PrismaService(); await db.$connect();
  companyId = (await db.company.create({ data: { ruc: `20${Date.now().toString().slice(-9)}`, issuer_ruc: ruc, legal_name: 'Prueba RC', sol_user: 'MODDATOS', sol_pass_encrypted: 'local' } })).id;
  originId = (await db.invoice.create({ data: { company_id: companyId, ruc_emisor: ruc, tipo_comprobante: '03', serie: 'B001', correlativo: 1, fecha_emision: new Date(hoy), estado: 'ACEPTADO', monto_total: 236, payload_ubl: fiscal8d('10', 0, '03').payload as never } })).id;
 });
 afterAll(async () => {
  if (db && companyId) {
   await db.transactionHistory.deleteMany({ where: { company_id: companyId } });
   await db.invoiceAggregate.deleteMany({ where: { company_id: companyId } });
   await db.invoice.deleteMany({ where: { company_id: companyId } }); await db.company.delete({ where: { id: companyId } });
  }
  if (db) await db.$disconnect(); if (originalDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDb;
 });
 it.each(['07', '08'])('nota %s: reserva repetible, XML 3, aceptación atómica y reversión durable', async tipo => {
  const id = randomUUID(); ids.push(id);
  await db.invoice.create({ data: { id, company_id: companyId, ruc_emisor: ruc, tipo_comprobante: tipo, serie: tipo === '07' ? 'BC01' : 'BD01', correlativo: 1, fecha_emision: new Date(hoy), estado: 'ACEPTADO', monto_total: 236,
   referenced_invoice_id: originId, credit_debit_reason_code: tipo === '07' ? '09' : '02', referenced_document_type: '03', referenced_series_correlative: 'B001-1', customer_identity_type: '6', customer_identity_number: '20100070970', total_igv: 36, payload_ubl: fiscal8d('10', 0, tipo).payload as never } });
  await db.transactionHistory.create({ data: { company_id: companyId, invoice_id: id, estado_nuevo: 'ACEPTADO', codigo_error: '0' } });
  const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job') };
  const store = new SummaryAggregateStore(db, queue as never); const views = new InvoiceSummaryService(db);
  const selection = [{ id, motivo: 'Error documentado, nota no otorgada al receptor' }];
  const reserve = () => store.reservar(companyId, 'RC', hoy, selection, { companyId, ruc, environment: 'MOCK' } as never,
   (tx, n, excludeId) => views.vistaAnulacionNotas(companyId, hoy, n, selection, tx, excludeId), true);
  const { row, vista } = await reserve(); expect(vista?.xml).toContain('<cbc:ConditionCode>3</cbc:ConditionCode>');
  await db.invoiceAggregate.update({ where: { id: row.id }, data: { state: 'POLLING', ticket: 'FAKE', xml: vista!.xml!, xml_hash: hashSummary(vista!.xml!) } });
  expect((await reserve()).row.id).toBe(row.id);
  const persisted = await db.invoiceAggregate.findUniqueOrThrow({ where: { id: row.id } });
  const cdr = new AdmZip(); cdr.addFile(`R-${ruc}-${row.identifier}.xml`, Buffer.from(`<ApplicationResponse><cac:DocumentResponse><cac:Response><cbc:ReferenceID>${row.identifier}</cbc:ReferenceID><cbc:ResponseCode>0</cbc:ResponseCode><cbc:Description>Aceptado ficticio</cbc:Description></cac:Response></cac:DocumentResponse></ApplicationResponse>`));
  const encoded = cdr.toBuffer().toString('base64');
  await store.finalizar(persisted, encoded, '0'); await store.finalizar(persisted, encoded, '0');
  expect((await db.invoice.findUniqueOrThrow({ where: { id } })).estado).toBe('ANULADO');
  expect(await db.transactionHistory.count({ where: { invoice_id: id, codigo_error: 'M1_RC_REVERSAL_PENDING' } })).toBe(1);
  expect((await db.invoiceAggregate.findUniqueOrThrow({ where: { id: row.id } })).result).toMatchObject({ bridgeReversals: [{ invoiceId: id, status: 'PENDING' }] });
  expect(queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
 });
});
