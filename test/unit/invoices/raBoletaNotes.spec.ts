import { construirComunicacionBaja, vaEnBaja } from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';
import { validarPlazoDespachoRa } from '../../../src/modules/invoices/application/services/summaryDispatchDeadline';
import { summaryDispatchHarness } from '../../fixtures/summaryDispatchHarness';
const fecha = '2026-11-13';
const nota = (tipoComprobante: string, serie: string) => ({ tipoComprobante, serie, correlativo: 1, fechaEmision: fecha, estado: 'ACEPTADO', total: 118, igv: 18, tipoDocCliente: '6', numDocCliente: '20100070970', documentoAfectado: serie.startsWith('B') ? 'B001-1' : 'F001-1' });
const casos = [['07', 'BC01', false], ['08', 'BD01', false], ['07', 'FC01', true], ['08', 'FD01', true]] as const;
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(`${fecha}T17:00:00Z`)); });
afterEach(() => jest.useRealTimers());
it.each(casos)('elegibilidad y XML %s/%s: %s', (tipo, serie, elegible) => {
  const doc = nota(tipo, serie);
  expect(vaEnBaja(doc)).toBe(elegible);
  const xml = () => construirComunicacionBaja({ rucEmisor: '20100070970', razonSocialEmisor: 'Empresa', fechaGeneracion: fecha, fechaResumen: fecha, correlativo: 1 }, [doc]);
  if (elegible) expect(xml()).toContain(`<sac:DocumentSerialID>${serie}</sac:DocumentSerialID>`);
  else expect(xml).toThrow(/nota.*RC/i);
});
it.each([{ documentoAfectado: 'B001-1' }, { tipoDocumentoAfectado: '03' }])('el vínculo a boleta también excluye una serie F inconsistente: %j', extra => {
  expect(vaEnBaja({ ...nota('07', 'FC01'), ...extra })).toBe(false);
});
it('vista previa excluye BC/BD con motivo y genera RA únicamente con FC/FD', async () => {
  const rows = casos.map(([tipo, serie]) => ({ id: serie, tipo_comprobante: tipo, serie, correlativo: 1, fecha_emision: new Date(fecha), estado: 'ACEPTADO', monto_total: 118, total_igv: 18, customer_identity_type: '6', customer_identity_number: '20100070970', referenced_series_correlative: serie.startsWith('B') ? 'B001-1' : 'F001-1', referenced_document_type: serie.startsWith('B') ? '03' : '01' }));
  const db = { invoice: { findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]) }, company: { findUnique: jest.fn(async () => ({ ruc: '20100070970', legal_name: 'Empresa' })) } };
  const view = await new InvoiceSummaryService(db as never).vistaComunicacionBaja('c', fecha);
  expect(view.lineas.map(l => [l.serie, l.incluido])).toEqual([['BC01', false], ['BD01', false], ['FC01', true], ['FD01', true]]);
  expect(view.lineas.slice(0, 2).every(l => l.motivoExclusion.includes('RC'))).toBe(true);
  expect(view.envio.lineas).toBe(2);
  expect(view.xml).not.toMatch(/BC01|BD01/);
  expect(view.xml).toMatch(/FC01/); expect(view.xml).toMatch(/FD01/);
});
it.each(casos)('despacho de RA ya preparada vuelve a comprobar %s/%s: %s', async (tipo, serie, elegible) => {
  const h = summaryDispatchHarness(); h.row.kind = 'RA'; h.job.tipo = 'COMUNICACION_BAJA'; h.row.members = [{ id: 'i' }] as never;
  const db = { invoice: { findMany: jest.fn(async () => [{ id: 'i', tipo_comprobante: tipo, serie, fecha_emision: new Date(fecha) }]) } };
  Object.assign(h.store, { validarPlazoDespacho: (row: never) => validarPlazoDespachoRa(db as never, row) });
  const result = await h.service.procesar(h.job, { maxConsultas: 0 });
  if (elegible) expect(h.client.sendSummary).toHaveBeenCalledTimes(1);
  else {
    expect(result).toMatchObject({ enviado: false, status: 'BLOQUEADO', error: expect.stringContaining('RA_DESPACHO_TIPO_INVALIDO') });
    expect(h.client.sendSummary).not.toHaveBeenCalled(); expect(h.store.reclamar).not.toHaveBeenCalled();
  }
});
