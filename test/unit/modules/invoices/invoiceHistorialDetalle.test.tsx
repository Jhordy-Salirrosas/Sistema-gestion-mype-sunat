import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { apiClient } from '@/lib/axios';
import { obtenerXmlDesdeBackend } from '@/modules/invoices/lib/invoiceDescarga';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({
  obtenerXmlDesdeBackend: vi.fn(async () => null),
  extraerDigestValue: vi.fn(() => null),
  descargarDesdeBackend: vi.fn(),
}));

const comprobante = construir({ tipo: '01', serie: 'F001', correlativo: 57, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 100, estado: 'ACEPTADO' });
const detalle = { id: comprobante.id, tipo_comprobante: '01', serie: 'F001', correlativo: 57, numero: 'F001-00000057', fecha_emision: '2026-11-05', estado: 'ACEPTADO', monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: 'Cliente', cdr_codigo: '0', ruc_emisor: '20601012341', base_imponible: 100, total_igv: 18, cdr: null };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('consulta el detalle y muestra fecha y mensaje del historial XSL', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...detalle, historial: [{ id: 'h1', created_at: '2026-11-05T22:40:00.000Z', mensaje_error: 'Validación XSL no concluyente: falta validate_utils.xsl' }] } } as never);
  render(<InvoiceCdrModal comprobante={comprobante} onCerrar={vi.fn()} />);
  expect((await screen.findByText(/Validación XSL no concluyente/)).textContent).toContain('2026-11-05T22:40:00.000Z');
  expect(apiClient.get).toHaveBeenCalledWith(`/invoices/${comprobante.id}`);
  expect(screen.getByText('Código CDR')).toBeTruthy();
});

it('mantiene el detalle cuando el historial está ausente', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: detalle } as never);
  render(<InvoiceCdrModal comprobante={comprobante} onCerrar={vi.fn()} />);
  expect(await screen.findByText('No hay eventos de auditoría registrados.')).toBeTruthy();
  expect(screen.getByText('Código CDR')).toBeTruthy();
});

it('muestra el aviso condicional de cuenta 74 en un comprobante con descuento 01', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: detalle } as never);
  vi.mocked(obtenerXmlDesdeBackend).mockResolvedValue('<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:AllowanceCharge><cbc:AllowanceChargeReasonCode>01</cbc:AllowanceChargeReasonCode></cac:AllowanceCharge></Invoice>');
  render(<InvoiceCdrModal comprobante={comprobante} onCerrar={vi.fn()} />);
  expect(await screen.findByText(/cuenta 74.*Podría quedar pendiente de revisión/)).toBeTruthy();
  expect(screen.getByText(/cuenta no está activa.*importes no concuerdan/)).toBeTruthy();
});
