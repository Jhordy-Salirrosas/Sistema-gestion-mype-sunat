import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../../src/database/prismaService';
import { SummaryAggregateStore } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
import { SummaryEnvioService } from '../../../src/modules/invoices/application/services/summaryEnvioService';
import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';
import { SummaryDispatchService } from '../../../src/modules/invoices/application/services/summaryDispatchService';
import { SummaryGate } from '../../../src/modules/invoices/application/services/summaryGate';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
const url = process.env.M1_AGGREGATE_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('M1 agregados: reserva durable, identidad y transacción real', () => {
  let db: PrismaService;
  let company: string, other: string;
  let store: SummaryAggregateStore, view: InvoiceSummaryService, envio: SummaryEnvioService, dispatch: SummaryDispatchService;
  let soap: { sendSummary: jest.Mock; getStatus: jest.Mock };
  let cola: { encolarResumen: jest.Mock };
  const oldUrl = process.env.DATABASE_URL;
  const ruc = '20000000001';
  beforeAll(async () => {
    if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Solo base local desechable');
    process.env.DATABASE_URL = url; db = new PrismaService(); await db.$connect();
    company = randomUUID(); other = randomUUID();
    await db.company.createMany({ data: [{ id: company, ruc, legal_name: 'Emisor ficticio', sol_user: 'fake', sol_pass_encrypted: 'fake' }, { id: other, ruc: '20000000002', legal_name: 'Otro ficticio', sol_user: 'fake', sol_pass_encrypted: 'fake' }] });
  });
  beforeEach(async () => {
    await db.invoiceAggregate.deleteMany({ where: { company_id: { in: [company, other] } } });
    await db.transactionHistory.deleteMany({ where: { company_id: company } });
    await db.invoice.deleteMany({ where: { company_id: { in: [company, other] } } });
    store = new SummaryAggregateStore(db); view = new InvoiceSummaryService(db);
    const fake = fakeIssuerCertificate();
    const signature = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never);
    const resolver = { resolve: async (id: string) => ({ companyId: id, ruc: id === company ? ruc : '20000000002', environment: 'BETA', endpoint: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService', sol: { username: 'FAKE', password: 'fake' }, certificate: { base64: 'fake', password: 'fake' } }) };
    soap = { sendSummary: jest.fn(async () => ({ ticket: 'T-FAKE' })), getStatus: jest.fn(async () => ({ statusCode: '98', enProceso: true, contenido: null })) };
    cola = { encolarResumen: jest.fn(async () => 'fake-job') };
    dispatch = new SummaryDispatchService(cola as never, soap as never, resolver as never, store, new SummaryGate());
    envio = new SummaryEnvioService(view, dispatch, signature, resolver as never, store, new SummaryGate());
  });
  afterAll(async () => {
    if (db) {
      await db.invoiceAggregate.deleteMany({ where: { company_id: { in: [company, other] } } });
      await db.transactionHistory.deleteMany({ where: { company_id: company } });
      await db.invoice.deleteMany({ where: { company_id: { in: [company, other] } } });
      await db.company.deleteMany({ where: { id: { in: [company, other] } } }); await db.$disconnect();
    }
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
  });
  function date() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); }
  async function invoice(serie = 'F001', n = 61, amount = 118, owner?: string, origin?: string) {
    return db.invoice.create({ data: { company_id: owner ?? company, ruc_emisor: ruc, tipo_comprobante: serie === 'FC01' ? '07' : '01', serie, correlativo: n,
      fecha_emision: new Date(date() + 'T12:00:00Z'), estado: 'ACEPTADO', monto_total: amount, total_igv: 18, customer_identity_type: '6', customer_identity_number: '20100070970', payload_ubl: {}, referenced_invoice_id: origin }  });
  }
  async function prepared() {
    const i = await invoice();
    const r = await envio.enviarComunicacionBaja(company, date(), [{ id: i.id, motivo: 'Error de prueba' }]);
    expect(r.enviado).toBe(true);
    const row = await store.cargar(company, r.identificador);
    return { i, row, job: { tipo: 'COMUNICACION_BAJA' as const, identificador: row.identifier, companyId: company, fileName: '', zipBase64: '' } };
  }
  function cdr(identifier: string, documents = '') {
    const z = new AdmZip(); z.addFile(`R-${ruc}-${identifier}.xml`, Buffer.from(`<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:DocumentResponse><cac:Response><cbc:ReferenceID>${identifier}</cbc:ReferenceID><cbc:ResponseCode>0</cbc:ResponseCode><cbc:Description>Aceptado ficticio</cbc:Description></cac:Response>${documents}</cac:DocumentResponse></ApplicationResponse>`)); return z.toBuffer().toString('base64');
  }
  it('excluye factura neutralizada por NC completa y documentos ya anulados', async () => {
    const source = await invoice(); const nc = await invoice('FC01', 13, 118, company, source.id);
    await db.invoice.update({ where: { id: nc.id }, data: { referenced_invoice_id: source.id } });
    const anulada = await invoice('F001', 62); await db.invoice.update({ where: { id: anulada.id }, data: { estado: 'ANULADO' } });
    const preview = await view.vistaComunicacionBaja(company, date());
    expect(preview.lineas.find(l => l.id === source.id)).toMatchObject({ incluido: false, motivoExclusion: expect.stringContaining('Neutralizado') });
    expect(preview.lineas.find(l => l.id === anulada.id)?.incluido).toBe(false);
    await expect(envio.enviarComunicacionBaja(company, date(), [{ id: source.id, motivo: 'Prueba' }])).rejects.toThrow(); expect(cola.encolarResumen).not.toHaveBeenCalled();
  });
  it('aísla selección y lectura entre empresas', async () => {
    const foreign = await invoice('F001', 61, 118, other);
    await expect(envio.enviarComunicacionBaja(company, date(), [{ id: foreign.id, motivo: 'Prueba' }])).rejects.toThrow();
    const { row } = await prepared(); await expect(store.cargar(other, row.identifier)).rejects.toThrow('SUMMARY_NOT_FOUND');
  });
  it('doble clic concurrente reserva un único identificador y no duplica sendSummary', async () => {
    const i = await invoice();
    const results = await Promise.all([1, 2].map(() => envio.enviarComunicacionBaja(company, date(), [{ id: i.id, motivo: 'Prueba' }])));
    expect(results[0].identificador).toBe(results[1].identificador); expect(await db.invoiceAggregate.count({ where: { company_id: company } })).toBe(1);
    const job = { tipo: 'COMUNICACION_BAJA' as const, identificador: results[0].identificador, companyId: company, fileName: '', zipBase64: '' };
    await Promise.all([1, 2].map(() => dispatch.procesar(job, { maxConsultas: 0 })));
    expect(soap.sendSummary).toHaveBeenCalledTimes(1);
  });
  it('persiste ticket y reentrega consulta sin segundo sendSummary', async () => {
    const { row, job } = await prepared(); await dispatch.procesar(job, { maxConsultas: 0 });
    expect((await store.cargar(company, row.identifier)).ticket).toBe('T-FAKE');
    await dispatch.procesar(job, { maxConsultas: 0 }); expect(soap.sendSummary).toHaveBeenCalledTimes(1); expect(soap.getStatus).toHaveBeenCalledTimes(2);
  });
  it('incertidumbre durable anterior a la red impide reenviar tras pérdida de respuesta', async () => {
    const { row, job } = await prepared();
    soap.sendSummary.mockImplementation(async () => { expect((await store.cargar(company, row.identifier)).transport_uncertain).toBe(true); throw new Error('Timeout simulado'); });
    await dispatch.procesar(job); await dispatch.procesar(job);
    expect(soap.sendSummary).toHaveBeenCalledTimes(1); expect((await store.cargar(company, row.identifier)).state).toBe('UNCERTAIN');
  });
  it('RA aceptada y miembros ANULADO se guardan en la misma transacción', async () => {
    const { i, row, job } = await prepared(); soap.getStatus.mockResolvedValue({ statusCode: '0', enProceso: false, contenido: cdr(row.identifier) });
    expect((await dispatch.procesar(job)).enviado).toBe(true);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: i.id } })).estado).toBe('ANULADO');
    expect((await store.cargar(company, row.identifier)).state).toBe('ACCEPTED');
    await dispatch.procesar(job); expect(soap.sendSummary).toHaveBeenCalledTimes(1);
  });
  it('CDR de otro agregado o con lista ajena no anula miembros', async () => {
    const { i, row } = await prepared();
    await expect(store.finalizar(row, cdr('RA-20261109-999'), '0')).rejects.toThrow('IDENTITY');
    await expect(store.finalizar(row, cdr(row.identifier, '<cac:DocumentReference><cbc:ID>F001-999</cbc:ID></cac:DocumentReference>'), '0')).rejects.toThrow('MEMBER');
    await expect(store.finalizar(row, cdr(row.identifier, '<cac:DocumentReference><cbc:ID><![CDATA[F001-999]]></cbc:ID></cac:DocumentReference>'), '0')).rejects.toThrow('MEMBER');
    expect((await db.invoice.findUniqueOrThrow({ where: { id: i.id } })).estado).toBe('ACEPTADO');
  });
  it('cambio concurrente del miembro revierte resultado y todas las anulaciones', async () => {
    const { i, row } = await prepared(); await db.invoice.update({ where: { id: i.id }, data: { estado: 'RECHAZADO' } });
    await expect(store.finalizar(row, cdr(row.identifier), '0')).rejects.toThrow('STATE_CHANGED');
    expect((await store.cargar(company, row.identifier)).state).toBe('QUEUED');
  });
  it('fallo de cola deja PREPARED y la recuperación publica el mismo identificador', async () => {
    const i = await invoice(); cola.encolarResumen.mockResolvedValueOnce(null);
    const first = await envio.enviarComunicacionBaja(company, date(), [{ id: i.id, motivo: 'Prueba' }]);
    expect(first.enviado).toBe(false); expect((await store.cargar(company, first.identificador)).state).toBe('PREPARED');
    await envio.recuperar(); expect((await store.cargar(company, first.identificador)).state).toBe('QUEUED');
    expect(await db.invoiceAggregate.count({ where: { company_id: company } })).toBe(1);
  });
  it('el listado del Monitor no expone XML/CDR ni datos de otra empresa', async () => {
    await prepared(); expect(await store.listar(other)).toEqual([]);
    const own = await store.listar(company); expect(own).toHaveLength(1); expect(own[0]).not.toHaveProperty('xml'); expect(own[0]).not.toHaveProperty('zip_base64');
  });
  it('el worker usa el ZIP persistido, no un payload adulterado del job', async () => {
    const { row, job } = await prepared(); await dispatch.procesar({ ...job, zipBase64: 'malicioso', fileName: 'otro.zip' }, { maxConsultas: 0 });
    expect(soap.sendSummary.mock.calls[0][0].fileName).toBe(`${ruc}-${row.identifier}.zip`);
    const zip = new AdmZip(soap.sendSummary.mock.calls[0][0].zip); expect(zip.getEntries()[0].getData().toString()).toContain('<VoidedDocuments');
  });

  it('reinicio durante preparación recupera RESERVED sin reservar otro identificador', async () => {
    const i = await invoice(); const context = { companyId: company, ruc, environment: 'BETA' };
    const selection = [{ id: i.id, motivo: 'Prueba' }];
    const { row } = await store.reservar(company, 'RA', date(), selection, context as never, (tx, n, excludeId) => view.vistaComunicacionBaja(company, date(), n, selection, tx, excludeId));
    await db.invoiceAggregate.update({ where: { id: row.id }, data: { updated_at: new Date(Date.now() - 90_000) } });
    await envio.recuperar(); expect((await store.cargar(company, row.identifier)).state).toBe('QUEUED');
    expect(await db.invoiceAggregate.count({ where: { company_id: company } })).toBe(1);
  });

});
