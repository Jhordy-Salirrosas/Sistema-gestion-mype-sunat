import AdmZip from 'adm-zip';
import { SummaryDispatchService } from '../../src/modules/invoices/application/services/summaryDispatchService';
import { hashSummary } from '../../src/modules/invoices/application/services/summaryGate';
/** Doubles for the protocol-only legacy tests; durable-store/XSD tests use real implementations. */
export function summaryDispatchForTest(queue: unknown, client: unknown, resolver?: unknown) {
  const xml = '<SummaryDocuments/>';
  const artifact = (companyId: string, identifier: string) => { const ruc = companyId === 'fake-company' ? '20000000001' : '20123456786'; const zip = new AdmZip(); zip.addFile(`${ruc}-${identifier}.xml`, Buffer.from(xml)); return { ruc, zip: zip.toBuffer().toString('base64') }; };
  const store = {
    cargar: async (companyId: string, identifier: string) => ({ id: 'aggregate', company_id: companyId, identifier, kind: identifier.startsWith('RA') ? 'RA' : 'RC', state: 'QUEUED', issuer_ruc: artifact(companyId, identifier).ruc, environment: 'MOCK', xml, xml_hash: hashSummary(xml), zip_base64: artifact(companyId, identifier).zip, ticket: null, transport_uncertain: false }),
    reclamar: async () => true, ticket: async () => undefined, pendiente: async () => undefined,
    finalizar: async () => undefined, revision: async () => undefined, rechazar: async () => undefined,
  };
  return new SummaryDispatchService(queue as never, client as never, (resolver ?? { resolve: async () => ({ ruc: '20123456786', environment: 'MOCK', endpoint: 'http://127.0.0.1/billService' }) }) as never, store as never, { validar: async () => undefined } as never);
}
