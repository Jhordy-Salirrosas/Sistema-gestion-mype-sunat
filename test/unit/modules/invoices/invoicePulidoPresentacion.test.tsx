import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { InvoiceStatusBadge } from '@/modules/invoices/components/InvoiceStatusBadge';
import { InvoiceAuditTrail } from '@/modules/invoices/components/InvoiceAuditTrail';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import type { ResultadoPresentacion } from '@/modules/invoices/lib/invoiceResultPresentation';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoiceById: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => null), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const fila = (resultado_presentacion?: ResultadoPresentacion) => ({ id: 'b5', tipo_comprobante: '03', serie: 'B001', correlativo: 5, numero: 'B001-00000005', fecha_emision: '2026-11-09', estado: 'RECHAZADO', monto_total: 17.7, moneda: 'PEN', cliente_documento: '12345678', cliente_nombre: 'CLIENTE', cdr_codigo: null, resultado_presentacion });
it.each(['3128: PaymentMeansID Contado', 'XSD: DebitNoteTypeCode no esperado'])('listado y detalle presentan bloqueo local con motivo %s, sin cambiar RECHAZADO', async motivo => {
  const resultado: ResultadoPresentacion = { origen: 'VALIDACION_LOCAL', codigo: '3128', motivo };
  const inv = aInvoice(fila(resultado)); const c = aComprobanteDemo(inv);
  expect(c.estadoBackend).toBe('RECHAZADO'); expect(c.estado).toBe('RECHAZADO');
  render(<InvoiceStatusBadge estado={c.estado} resultado={c.resultadoPresentacion} />);
  expect(screen.getByLabelText('Bloqueado por validación local')).toBeTruthy(); cleanup();
  vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({ ...inv, tieneCdr: false, historial: [] });
  // El detalle debe hidratar su causa aun si se abrió desde una lista antigua sin metadatos.
  render(<InvoiceCdrModal comprobante={aComprobanteDemo(aInvoice(fila()))} onCerrar={vi.fn()} />);
  await screen.findByLabelText('Bloqueado por validación local');
  expect(screen.getAllByText(motivo).length).toBeGreaterThan(0);
  expect(screen.queryByText('Rechazado sin CDR')).toBeNull();
  expect(screen.queryByText(/SUNAT todavía no respondió/)).toBeNull();
  expect(screen.queryByText('SUNAT rechazó el comprobante. No tiene validez fiscal.')).toBeNull();
});
it('un rechazo SUNAT confirmado conserva su origen y un desconocido no lo inventa', () => {
  const c = aComprobanteDemo(aInvoice(fila({ origen: 'SUNAT', codigo: '2335', motivo: 'SOAP Fault del billService [2335]: duplicado' })));
  render(<InvoiceAuditTrail comprobante={c} digest={null} />);
  expect(screen.getByText('SUNAT respondió con rechazo del comprobante.')).toBeTruthy();
  expect(screen.getByText('Sin CDR: SUNAT respondió mediante SOAP Fault')).toBeTruthy(); cleanup();
  render(<InvoiceStatusBadge estado="RECHAZADO" codigo="3128" />);
  expect(screen.getByLabelText('Rechazado (origen no confirmado)')).toBeTruthy();
});

it('un código legado aislado no se presenta como CDR cuando hay prueba de bloqueo local', () => {
  const c = aComprobanteDemo(aInvoice({ ...fila({ origen: 'VALIDACION_LOCAL', codigo: '3128', motivo: 'Validación local' }), cdr_codigo: '3128' }));
  render(<InvoiceAuditTrail comprobante={c} digest={null} />);
  expect(screen.getByText('Sin CDR: bloqueo previo al envío')).toBeTruthy();
  expect(screen.queryByText('Sin código: SUNAT todavía no respondió')).toBeNull();
});
