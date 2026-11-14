import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { apiClient } from '@/lib/axios';
import { InvoiceSunatConsulta } from '@/modules/invoices/components/InvoiceSunatConsulta';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => null), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const recuperado = { tipo: 'RECUPERADO', estado: 'ACEPTADO', codigo: '0', mensaje: 'Factura aceptada por SUNAT' };
it('detalle consulta solo por acción explícita y muestra estado, código y mensaje sin cerrar', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({data:{id:'doc',estado:'ERROR_RED',cdr:null,historial:[]}});
  vi.mocked(apiClient.post).mockResolvedValue({ data: recuperado });
  const onCerrar = vi.fn();
  const comprobante = construir({ tipo: '01', serie: 'F001', correlativo: 60, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-09', base: 100, estado: 'SIN_CONFIRMAR' });
  render(<InvoiceCdrModal comprobante={comprobante} onCerrar={onCerrar} />);
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar SUNAT' }));
  expect(await screen.findByText('Mensaje: Factura aceptada por SUNAT')).toBeTruthy();
  expect(screen.getByText('Estado: ACEPTADO')).toBeTruthy(); expect(screen.getByText('Código: 0')).toBeTruthy();
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(`/invoices/${comprobante.id}/consultar-sunat`);
  expect(onCerrar).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeTruthy();
});
it.each([
  [{ tipo: 'SIN_TRANSMISION', motivo: 'Sin transmisión acreditada' }, 'SIN_TRANSMISION', 'Sin transmisión acreditada'],
  [{ tipo: 'NO_ENCONTRADO' }, 'NO_ENCONTRADO', 'Comprobante no encontrado en SUNAT.'],
  [{ tipo: 'INCIERTO', motivo: 'La consulta no pudo determinar el estado' }, 'INCIERTO', 'La consulta no pudo determinar el estado'],
])('presenta consulta %j sin inventar aceptación ni código', async (data, estado, mensaje) => {
  vi.mocked(apiClient.post).mockResolvedValue({ data }); render(<InvoiceSunatConsulta id="invoice" />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar SUNAT' }));
  expect(await screen.findByText(`Estado: ${estado}`)).toBeTruthy();
  expect(screen.getByText('Código: No informado')).toBeTruthy(); expect(screen.getByText(`Mensaje: ${mensaje}`)).toBeTruthy();
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/invoices/invoice/consultar-sunat');
});
it('deshabilita consultas simultáneas y no dispara ninguna acción de cola', async () => {
  let resolver!: (value: { data: typeof recuperado }) => void;
  vi.mocked(apiClient.post).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  render(<InvoiceSunatConsulta id="invoice" />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar SUNAT' }));
  const button = screen.getByRole('button', { name: 'Consultando SUNAT…' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); fireEvent.click(button); expect(apiClient.post).toHaveBeenCalledTimes(1);
  resolver({ data: recuperado });
  expect(await screen.findByText('Estado: ACEPTADO')).toBeTruthy();
});
it('muestra fallo de consulta dentro de la vista y permite intentarlo otra vez', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('red caída'));
  render(<InvoiceSunatConsulta id="invoice" />); fireEvent.click(screen.getByRole('button', { name: 'Consultar SUNAT' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByRole('status')).toBeNull();
  expect((screen.getByRole('button', { name: 'Consultar SUNAT' }) as HTMLButtonElement).disabled).toBe(false);
});
it('respuesta inesperada no se presenta como un estado fiscal válido', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { tipo: 'DESCONOCIDO' } });
  render(<InvoiceSunatConsulta id="invoice" />); fireEvent.click(screen.getByRole('button', { name: 'Consultar SUNAT' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByRole('status')).toBeNull();
});
