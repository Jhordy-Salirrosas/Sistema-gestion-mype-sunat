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
/** Observable protocol boundaries for failure/recovery unit tests. */
export function summaryDispatchHarness() {
  const xml='<SummaryDocuments/>'; const identifier='RC-20261109-001'; const ruc='20000000001';
  const zip=new AdmZip(); zip.addFile(`${ruc}-${identifier}.xml`,Buffer.from(xml));
  const row={id:'aggregate',company_id:'company',identifier,kind:'RC',state:'QUEUED',issuer_ruc:ruc,environment:'BETA',xml:xml as string|null,xml_hash:hashSummary(xml),zip_base64:zip.toBuffer().toString('base64') as string|null,ticket:null as string|null,transport_uncertain:false,result:null as Record<string,string|null>|null,error:null as string|null};
  const store={cargar:jest.fn(async()=>row),reclamar:jest.fn(async()=>true),ticket:jest.fn(async()=>undefined),pendiente:jest.fn(async()=>undefined),finalizar:jest.fn(async()=>undefined),revision:jest.fn(async()=>undefined),rechazar:jest.fn(async()=>undefined)};
  const queue={encolarResumen:jest.fn(async()=> 'job')};
  const client={sendSummary:jest.fn(async()=>({ticket:'T-FAKE'})),getStatus:jest.fn(async()=>({statusCode:'0' as string|null,enProceso:false,contenido:'cdr' as string|null}))};
  const context={companyId:'company',ruc,timeoutMs:90000,environment:'BETA',endpoint:'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',sol:{username:'FAKE',password:'fake'} as {username:string;password:string}|null};
  const resolver={resolve:jest.fn(async()=>context)}; const gate={validar:jest.fn(async()=>undefined)};
  const service=new SummaryDispatchService(queue as never,client as never,resolver as never,store as never,gate as never);
  const job={companyId:'company',identificador:identifier,tipo:'RESUMEN_DIARIO' as const,zipBase64:'untrusted',fileName:'untrusted'};
  return {row,store,queue,client,context,resolver,gate,service,job};
}
