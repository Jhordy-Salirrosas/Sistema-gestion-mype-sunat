import { afterEach, expect, it, vi } from 'vitest';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { construirPdfBinarioSunat, descargarPdfComprobante, tramaQrDelComprobante } from '@/modules/invoices/lib/invoiceExportPdf';
import { extraerDigestValue, obtenerXmlDesdeBackend } from '@/modules/invoices/lib/invoiceDescarga';
import { useAuthStore } from '@/stores/authStore';
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(), extraerDigestValue: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState({ activeCompany: null }); });
it.each(['01','03','07','08'] as const)('F10 dibuja un QR vectorial en PDF rápido tipo %s con trama fiscal correcta', (tipo) => {
  useAuthStore.setState({ activeCompany: { tenantId: 't', ruc: '20601234567', razonSocial: 'Emisor' } });
  const c = { ...construir({ tipo, serie: tipo === '03' ? 'B001' : 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-07', base: 100, estado: 'ACEPTADO' }), hashCpe: 'DIGEST-BASE64=' };
  expect(tramaQrDelComprobante(c)).toContain(`20601234567|${tipo}|`);
  expect(tramaQrDelComprobante(c)).toContain('DIGEST-BASE64=');
  const pdf = construirPdfBinarioSunat(c);
  expect(pdf).toContain('% QR SUNAT'); expect(pdf.match(/ re f/g)!.length).toBeGreaterThan(100);
  const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]); expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
});
it('F10 no produce un PDF con QR falso si no existe XML firmado', async () => {
  vi.mocked(obtenerXmlDesdeBackend).mockResolvedValue(null); vi.mocked(extraerDigestValue).mockReturnValue(null);
  const c = construir({ tipo:'03', serie:'B001', correlativo:1, ruc:'20100070970', razonSocial:'Cliente', fecha:'2026-11-07', base:100, estado:'EN_COLA' });
  await expect(descargarPdfComprobante(c)).rejects.toThrow('XML firmado');
});
