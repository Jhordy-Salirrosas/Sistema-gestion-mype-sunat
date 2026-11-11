import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []), getSaldoNota: vi.fn(async () => ({ total: 1770, devuelto: 100.01, disponible: 1669.99, cantidades_pendientes: [] })), emitirComprobante: vi.fn() } }));
describe('saldo de nota de crédito', () => {
  it('consulta y muestra el saldo y bloquea exceso sin emitir', async () => {
    const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 1500, estado: 'ACEPTADO' });
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
    expect(await screen.findByText(/Disponible según servidor S\/ 1669.99/)).toBeTruthy();
    expect(screen.getByText(/base S\/ 1500.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Servicio' } });
    fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '2000' } });
    expect(screen.getByText(/La nota supera el saldo disponible/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Emitir Nota de Crédito' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup(); query.clear();
  });
});

it('muestra saldo en nota de débito y parte de línea vacía', async () => {
  const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 1500, estado: 'ACEPTADO' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="08" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  expect((screen.getByLabelText('Código de la línea 1') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
  expect(await screen.findByText(/Disponible según servidor S\/ 1669.99/)).toBeTruthy();
  cleanup(); query.clear();
});
it('avisa el acreditado superior al total sin esconder el saldo', async () => {
  vi.mocked(invoicesApi.getSaldoNota).mockResolvedValueOnce({ total: 1003, devuelto: 1053.01, disponible: 0, cantidades_pendientes: [] });
  const factura = construir({ tipo: '01', serie: 'F001', correlativo: 53, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 850, estado: 'ACEPTADO' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000053' } });
  expect(await screen.findByText(/supera el total del comprobante/)).toBeTruthy();
  expect(screen.getByText(/Disponible según servidor S\/ 0.00/)).toBeTruthy();
  cleanup(); query.clear();
});

it('muestra el comprobante origen (tipo, serie-número, cliente e importe) desde el primer paso antes de la grilla de líneas', () => {
  const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'FERRETERIA NORTE', fecha: '2026-11-05', base: 1500, estado: 'ACEPTADO' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  const docInput = screen.getByLabelText('Documento afectado');
  const lineaInput = screen.getByLabelText('Descripción de la línea 1');
  expect(docInput.compareDocumentPosition(lineaInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(docInput, { target: { value: 'F001-00000056' } });
  const resumen = screen.getByTestId('resumen-comprobante-origen');
  expect(resumen.textContent).toContain('Factura (01)');
  expect(resumen.textContent).toContain('F001-00000056');
  expect(resumen.textContent).toContain('FERRETERIA NORTE');
  expect(resumen.textContent).toContain('Importe total S/ 1770.00');
  cleanup(); query.clear();
});

it('muestra la sección del certificado digital (archivo, estado y vencimiento) visible y directa en Configuración', () => {
  render(
    <InvoiceIssuerConfigForm
      ruc="20100070970"
      guardar={vi.fn()}
      config={{
        entorno: 'BETA',
        perfil_comercial: 'MAYORISTA',
        cert_password_configurada: true,
        certificado: {
          archivo: 'certificado-20100070970.p12 (custodia empresa)',
          configurado: true,
          estado: 'VIGENTE',
          vence_el: '2027-05-15',
          dias_restantes: 189,
          origen: 'company',
        },
      }}
    />,
  );
  const seccion = screen.getByTestId('seccion-certificado-digital');
  expect(seccion.textContent).toContain('Certificado Digital (.PFX / .P12)');
  expect(seccion.textContent).toContain('certificado-20100070970.p12 (custodia empresa)');
  expect(seccion.textContent).toContain('Vigente');
  expect(seccion.textContent).toContain('2027-05-15 (189 días restantes)');
  cleanup();
});
