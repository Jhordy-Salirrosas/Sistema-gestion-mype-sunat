import { SummaryEnvioService } from '../../src/modules/invoices/application/services/summaryEnvioService';
/** Isolates signing-context propagation from the durable repository and SFS. */
export function summaryEnvioForTest(views: unknown, dispatch: unknown, signature: unknown, _db: unknown, resolver: unknown) {
  const row = { id: 'a', identifier: 'RA-20261101-001', company_id: 'fake-company', issuer_ruc: '20000000001', kind: 'RA', state: 'RESERVED', members: [{ id: 'i' }], job_id: null };
  const store = { reservar: async () => ({ row, vista: { xml: '<SummaryDocuments/>' } }), artefacto: async (_r: unknown, xml: string, zip: string) => ({ ...row, state: 'PREPARED', xml, zip_base64: zip }), encolado: async () => undefined, bloquear: async () => undefined };
  return new SummaryEnvioService(views as never, dispatch as never, signature as never, resolver as never, store as never, { validar: async () => undefined } as never);
}
