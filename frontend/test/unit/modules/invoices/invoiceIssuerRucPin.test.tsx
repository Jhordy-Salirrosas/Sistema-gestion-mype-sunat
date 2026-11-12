import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { cargarIdentidadEmisora, identidadEmisora, rucEmisorActual } from '@/modules/invoices/lib/invoiceExportConstants';
import { construirPdfBinarioSunat, descargarPdfComprobante, tramaQrDelComprobante } from '@/modules/invoices/lib/invoiceExportPdf';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/modules/invoices/components/InvoiceSunatConsulta', () => ({ InvoiceSunatConsulta: () => <span>Consulta SUNAT disponible</span> }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoiceById: vi.fn(async () => ({ historial: [] })) } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({
  obtenerXmlDesdeBackend: vi.fn(async () => '<Invoice><DigestValue>DIGEST-PIN=</DigestValue></Invoice>'),
  extraerDigestValue: vi.fn(() => 'DIGEST-PIN='), descargarDesdeBackend: vi.fn(),
}));
const empresa = { tenantId: 'pin-tenant', ruc: '20614142503', razonSocial: 'Emisor de prueba' };
const c = { ...construir({ tipo: '01', serie: 'F001', correlativo: 7, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-12', base: 100, estado: 'ACEPTADO' }), hashCpe: 'DIGEST-PIN=' };
beforeEach(() => {
  useAuthStore.setState({ activeCompany: empresa, token: 'fake-token' });
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ruc: '20601234567' } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ activeCompany: null, token: null }); });

it('consulta la configuración efectiva sin cambiar la identidad de empresa de la sesión', async () => {
  expect(await cargarIdentidadEmisora()).toEqual({ ruc: '20601234567', razonSocial: empresa.razonSocial, hayEmisor: true });
  expect(apiClient.get).toHaveBeenCalledWith('/invoices/config');
  expect(useAuthStore.getState().activeCompany?.ruc).toBe(empresa.ruc);
  expect(await rucEmisorActual()).toBe('20601234567');
});
it('sin pin la configuración y el respaldo de sesión mantienen el comportamiento previo', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ruc: empresa.ruc } });
  expect(await cargarIdentidadEmisora()).toEqual(identidadEmisora());
});
it.each([undefined, '', 'invalid'])('configuración sin RUC utilizable %s usa el respaldo de sesión', async ruc => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ruc } });
  expect((await cargarIdentidadEmisora()).ruc).toBe(empresa.ruc);
});
it('si la API no responde usa el RUC de sesión y no conserva un pin de una consulta anterior', async () => {
  expect((await cargarIdentidadEmisora()).ruc).toBe('20601234567');
  vi.mocked(apiClient.get).mockRejectedValueOnce(Error('Sin respuesta'));
  expect((await cargarIdentidadEmisora()).ruc).toBe(empresa.ruc);
});
it('sin empresa no consulta ni inventa un emisor', async () => {
  useAuthStore.setState({ activeCompany: null });
  expect(await cargarIdentidadEmisora()).toEqual({ ruc: '', razonSocial: '', hayEmisor: false });
  expect(apiClient.get).not.toHaveBeenCalled();
});
it.each(['empresa', 'token'])('descarta la respuesta si cambia %s durante la consulta', async change => {
  let complete!: (value: never) => void;
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = cargarIdentidadEmisora();
  useAuthStore.setState(change === 'empresa' ? { activeCompany: { ...empresa, tenantId: 'other' } } : { token: 'other-token' });
  complete({ data: { ruc: '20601234567' } } as never);
  await expect(pending).rejects.toThrow('La sesión cambió');
});
it('PDF binario y trama usan el mismo RUC obtenido de la configuración', async () => {
  const emisor = await cargarIdentidadEmisora();
  const pdf = construirPdfBinarioSunat(c, emisor);
  expect(pdf).toContain('R.U.C. N° 20601234567');
  expect(pdf).toContain('20601234567|01|F001|7|');
  expect(pdf).not.toContain(empresa.ruc);
  expect(tramaQrDelComprobante(c, emisor)).toMatch(/^20601234567\|01\|/);
});
it('la descarga del PDF obtiene la configuración antes de generar el archivo', async () => {
  let blob!: Blob;
  vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:fake'; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await descargarPdfComprobante(c);
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob);
  });
  expect(text).toContain('R.U.C. N° 20601234567');
  expect(text).toContain('20601234567|01|F001|7|');
});
it.each([true, false])('el QR del modal usa configuración disponible=%s y respaldo de sesión si falla', async available => {
  if (!available) vi.mocked(apiClient.get).mockRejectedValue(Error('Sin respuesta'));
  render(<InvoiceCdrModal comprobante={c} onCerrar={() => {}} />);
  const expected = available ? '20601234567' : empresa.ruc;
  expect((await screen.findByText(new RegExp(`Trama QR: ${expected}\\|01\\|`))).textContent).toContain('DIGEST-PIN|');
});
it('el modal no muestra una respuesta tardía del tenant anterior', async () => {
  let complete!: (value: never) => void;
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  render(<InvoiceCdrModal comprobante={c} onCerrar={() => {}} />);
  useAuthStore.setState({ activeCompany: { ...empresa, tenantId: 'other', ruc: '20100070970' } });
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ruc: '20100070970' } });
  complete({ data: { ruc: '20601234567' } } as never);
  await waitFor(() => expect(screen.queryByText(/Trama QR: 20601234567/)).toBeNull());
  expect(await screen.findByText(/Trama QR: 20100070970/)).toBeTruthy();
});

it.each([['B001',undefined,false],['F001','PREPARACION_LOCAL',false],['F001','SUNAT',true]] as const)('consulta SUNAT en serie %s origen %s visible=%s',async(serie,origen,visible)=>{
 render(<InvoiceCdrModal comprobante={{...c,serie,resultadoPresentacion:origen?{origen}:undefined} as never} onCerrar={()=>{}}/>);
 expect(Boolean(screen.queryByText('Consulta SUNAT disponible'))).toBe(visible);
 await screen.findByText(/Trama QR:/);
});
