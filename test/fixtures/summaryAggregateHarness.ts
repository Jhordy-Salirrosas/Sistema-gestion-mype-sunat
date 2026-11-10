import AdmZip from 'adm-zip';
import { SummaryAggregateStore } from '../../src/modules/invoices/application/services/summaryAggregateStore';
import { hashSummary } from '../../src/modules/invoices/application/services/summaryGate';
/** DB/queue boundaries only: transactions execute the real store callback. */
export function aggregateHarness(kind = 'RA') {
  const identifier = `${kind}-20261109-001`;
  const member = { id: 'invoice', serie: kind === 'RA' ? 'F001' : 'B001', correlativo: 1, tipoComprobante: kind === 'RA' ? '01' : '03' };
  const line = kind === 'RA' ? '<sac:VoidedDocumentsLine><cbc:LineID>1</cbc:LineID><cbc:DocumentTypeCode>01</cbc:DocumentTypeCode><sac:DocumentSerialID>F001</sac:DocumentSerialID><sac:DocumentNumberID>1</sac:DocumentNumberID></sac:VoidedDocumentsLine>' : '<sac:SummaryDocumentsLine><cbc:LineID>1</cbc:LineID><cbc:DocumentTypeCode>03</cbc:DocumentTypeCode><cbc:ID>B001-00000001</cbc:ID></sac:SummaryDocumentsLine>';
  const root = kind === 'RA' ? 'VoidedDocuments' : 'SummaryDocuments';
  const row = { id: 'aggregate', company_id: 'company', kind, identifier, fingerprint: 'hash', reference_date: '2026-11-09', generation_date: '2026-11-09', state: 'POLLING', issuer_ruc: '20000000001', environment: 'BETA', xml: `<${root}>${line}</${root}>`, xml_hash: '', zip_base64: null as string | null, members: [member], ticket: 'T-FAKE', transport_uncertain: false, result: null, error: null, job_id: null, created_at: new Date(), updated_at: new Date() };
  row.xml_hash = hashSummary(row.xml);
  const delegate = { findUnique: jest.fn(async () => null as unknown), findUniqueOrThrow: jest.fn(async () => row), findFirst: jest.fn(async () => row as typeof row | null), findMany: jest.fn(async () => [] as unknown[]), create: jest.fn(async ({ data }) => ({ ...row, ...data })), update: jest.fn(async ({ data }) => ({ ...row, ...data })), updateMany: jest.fn(async () => ({ count: 1 })) };
  const db = { invoiceAggregate: delegate, invoice: { updateMany: jest.fn(async () => ({ count: 1 })) }, $executeRaw: jest.fn(async () => 1), $transaction: jest.fn() };
  db.$transaction.mockImplementation(async fn => fn(db));
  const queue = { enqueueInvoiceInTx: jest.fn(async () => 'accounting-job' as string | null) };
  const store = new SummaryAggregateStore(db as never, queue as never);
  const context = { companyId: 'company', ruc: row.issuer_ruc, environment: 'BETA' };
  const selection = [{ id: member.id, motivo: 'Anulación de la operación' }];
  const vista = { envio: { identificador: identifier, tipo: kind === 'RA' ? 'COMUNICACION_BAJA' : 'RESUMEN_DIARIO', fechaReferencia: '2026-11-09', correlativo: 1, lineas: 1 }, lineas: [{ ...member, fechaEmision: '2026-11-09', estado: 'ACEPTADO', reenviable: false, total: 118, incluido: true, motivoExclusion: '', dias: 0 }], xml: `<${root}><cbc:ID>${identifier}</cbc:ID><cbc:IssueDate>2026-11-09</cbc:IssueDate>${line}</${root}>` as string | null, errores: [] as string[] };
  const preview = jest.fn(async () => vista);
  const reserve = () => store.reservar('company', kind as 'RA' | 'RC', '2026-11-09', selection, context as never, preview as never);
  const cdr = (code = '0', documents = '', reference = identifier, ruc = row.issuer_ruc) => {
    const zip = new AdmZip();
    zip.addFile(`R-${ruc}-${reference}.xml`, Buffer.from(`<ApplicationResponse><cac:DocumentResponse><cac:Response><cbc:ReferenceID>${reference}</cbc:ReferenceID><cbc:ResponseCode>${code}</cbc:ResponseCode><cbc:Description>Resultado ficticio</cbc:Description></cac:Response>${documents}</cac:DocumentResponse></ApplicationResponse>`));
    return zip.toBuffer().toString('base64');
  };
  return { row, member, delegate, db, queue, store, context, selection, vista, preview, reserve, cdr };
}
