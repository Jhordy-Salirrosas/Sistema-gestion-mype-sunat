import AdmZip from 'adm-zip';
import { SummaryEnvioService, seleccionBaja } from '../../../src/modules/invoices/application/services/summaryEnvioService';
import { hashSummary } from '../../../src/modules/invoices/application/services/summaryGate';
const selection = [{ id: 'invoice', motivo: 'Anulación de la operación' }];
function harness() {
  const row = { id: 'a', company_id: 'empresa', kind: 'RA', identifier: 'RA-20261109-001', state: 'RESERVED', members: [{ id: 'invoice' }], job_id: null, issuer_ruc: '20000000001', environment: 'BETA', xml: null as string | null, zip_base64: null as string | null };
  const view = { xml: '<VoidedDocuments><cbc:ID>RA-20261109-001</cbc:ID></VoidedDocuments>', errores: [], lineas: [{ id: 'invoice', incluido: true }] };
  const context = { companyId: 'empresa', ruc: row.issuer_ruc, environment: 'BETA', endpoint: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService' };
  const store = { reservar: jest.fn(async () => ({ row, vista: view as typeof view | undefined })), artefacto: jest.fn(async (_r, xml, zip) => ({ ...row, xml, xml_hash: hashSummary(xml), zip_base64: zip })), encolado: jest.fn(async () => undefined), bloquear: jest.fn(async () => undefined), pendientes: jest.fn(async () => []) };
  const despacho = { encolar: jest.fn(async () => 'job' as string | null) };
  const firma = { signXml: jest.fn((xml: string) => ({ signedXml: xml + '<!--firmado-->' })) };
  const gate = { validar: jest.fn(async () => undefined) };
  const svc = new SummaryEnvioService({} as never, despacho as never, firma as never, { resolve: async () => context } as never, store as never, gate as never);
  return { row, view, context, store, despacho, firma, gate, svc };
}
it('sin selección explícita no hay reserva, firma ni cola', async () => {
  const h = harness(); await expect(h.svc.enviarComunicacionBaja('empresa', '2026-11-09')).rejects.toThrow('Seleccione');
  expect(h.store.reservar).not.toHaveBeenCalled(); expect(h.firma.signXml).not.toHaveBeenCalled();
});
it.each([[], [{ id: '' }], [{ id: 'i', motivo: '' }], [{ id: 'i', motivo: 'x'.repeat(101) }], [{ id: 'i' }, { id: 'i' }]].map(input => [input]))('valida selección y motivos: %j', input => { expect(() => seleccionBaja(input)).toThrow(); });
it('motivo omitido usa el valor inicial acordado, sin aceptar vacío', () => { expect(seleccionBaja([{ id: 'i' }])).toEqual([{ id: 'i', motivo: 'Anulación de la operación' }]); });
it('firma, valida y conserva artefacto antes de encolar en BETA', async () => {
  const h = harness(); expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: true, jobId: 'job' });
  expect(h.firma.signXml).toHaveBeenCalledWith(h.view.xml, h.context);
  expect(h.gate.validar.mock.invocationCallOrder[0]).toBeLessThan(h.despacho.encolar.mock.invocationCallOrder[0]);
  expect(h.store.artefacto.mock.invocationCallOrder[0]).toBeLessThan(h.despacho.encolar.mock.invocationCallOrder[0]);
  expect(h.store.encolado).toHaveBeenCalledWith('a', 'job');
});
it('ZIP conserva nombre SUNAT y XML firmado', async () => {
  const h = harness(); await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection);
  const job = h.despacho.encolar.mock.calls[0][0] as unknown as { zipBase64: string; fileName: string };
  const zip = new AdmZip(Buffer.from(job.zipBase64, 'base64'));
  expect(job.fileName).toBe('20000000001-RA-20261109-001.zip'); expect(zip.getEntries().map(e => e.entryName)).toEqual(['20000000001-RA-20261109-001.xml']);
  expect(zip.getEntries()[0].getData().toString()).toContain('<!--firmado-->');
});
it('regla de selección rechazada no llega a firmar', async () => {
  const h = harness(); h.store.reservar.mockRejectedValue(new Error('No hay comprobantes incluidos'));
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: false, motivo: expect.stringContaining('incluidos') }); expect(h.firma.signXml).not.toHaveBeenCalled();
});
it('fallo de firma queda visible y no encola', async () => {
  const h = harness(); h.firma.signXml.mockImplementation(() => { throw new Error('sin certificado'); });
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: false, motivo: 'sin certificado' }); expect(h.despacho.encolar).not.toHaveBeenCalled();
});
it('validación no concluyente no encola ni abre la red', async () => {
  const h = harness(); h.gate.validar.mockRejectedValue(new Error('SFS no disponible'));
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: false, motivo: 'SFS no disponible' }); expect(h.despacho.encolar).not.toHaveBeenCalled();
});
it('cola caída conserva artefacto PREPARED recuperable', async () => {
  const h = harness(); h.despacho.encolar.mockResolvedValue(null);
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: false, jobId: null }); expect(h.store.artefacto).toHaveBeenCalled();
});
it('reserva ya en cola es idempotente sin otra publicación', async () => {
  const h = harness(); h.row.state = 'QUEUED'; h.store.reservar.mockResolvedValue({ row: h.row, vista: undefined });
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: true }); expect(h.despacho.encolar).not.toHaveBeenCalled();
});
it('reserva incierta no se vuelve a enviar por HTTP', async () => {
  const h = harness(); h.row.state = 'UNCERTAIN';
  expect(await h.svc.enviarComunicacionBaja('empresa', '2026-11-09', selection)).toMatchObject({ enviado: false, motivo: expect.stringContaining('UNCERTAIN') }); expect(h.despacho.encolar).not.toHaveBeenCalled();
});
it('RC sigue cerrado hasta la parte 2B', async () => {
  const h = harness(); expect(await h.svc.enviarResumenDiario('empresa', '2026-11-09')).toMatchObject({ enviado: false }); expect(h.despacho.encolar).not.toHaveBeenCalled();
});
