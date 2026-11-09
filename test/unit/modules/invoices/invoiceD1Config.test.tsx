import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient } from '@/lib/axios';
import { useInvoiceConfig } from '@/modules/invoices/hooks/useInvoiceConfig';
import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const config = { ruc: '20100070970', entorno: 'MOCK', origen_efectivo: 'company' as const,
  origen_sol: 'deployment' as const, origen_certificado: 'company' as const,
  sol_password_configurada: true, cert_password_configurada: true, series: [] };
function Harness() {
  const { data, guardar } = useInvoiceConfig(config.ruc);
  return data ? <InvoiceIssuerConfigForm config={data} ruc={config.ruc} guardar={guardar} /> : <p>Cargando</p>;
}
function mount() {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: url === '/invoices/config' ? config : [] }));
  vi.mocked(apiClient.put).mockResolvedValue({ data: config });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  return client;
}
it('carga el GET, presenta origen por grupo y MOCK, sin rellenar secretos', async () => {
  const client = mount();
  await screen.findByText('Ambiente efectivo: MOCK (simulado)');
  expect(screen.getByText('Origen efectivo: Configuración guardada de la empresa')).toBeTruthy();
  expect(screen.getByText('Origen SOL: Respaldo del despliegue')).toBeTruthy();
  expect(screen.getByText('Contraseña SOL: configurado')).toBeTruthy();
  for (const label of ['Usuario SOL', 'Nueva contraseña SOL', 'Nueva contraseña del certificado']) {
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
  }
  expect((screen.getByLabelText('RUC (no editable)') as HTMLInputElement).readOnly).toBe(true);
  client.clear();
});
it('PUT solo envía lo escrito y cambiado; limpia las contraseñas después de guardar', async () => {
  const client = mount();
  await screen.findByLabelText('Usuario SOL');
  fireEvent.change(screen.getByLabelText('Usuario SOL'), { target: { value: 'NUEVO' } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña SOL'), { target: { value: 'clave-nueva' } });
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'BETA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await screen.findByText('Configuración guardada.');
  expect(apiClient.put).toHaveBeenCalledWith('/invoices/config', { sol_user: 'NUEVO', sol_password: 'clave-nueva', entorno: 'BETA' });
  expect((screen.getByLabelText('Nueva contraseña SOL') as HTMLInputElement).value).toBe('');
  client.clear();
});
it('no envía contraseñas vacías al cambiar solo el ambiente', async () => {
  const client = mount(); await screen.findByLabelText('Ambiente');
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'BETA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await screen.findByText('Configuración guardada.');
  expect(apiClient.put).toHaveBeenCalledWith('/invoices/config', { entorno: 'BETA' });
  client.clear();
});
it('convierte el archivo a base64 sin prefijo y envía solo el grupo del certificado', async () => {
  const client = mount(); await screen.findByLabelText('Certificado digital PKCS#12');
  fireEvent.change(screen.getByLabelText('Certificado digital PKCS#12'), { target: { files: [new File(['test'], 'cert.p12')] } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña del certificado'), { target: { value: 'clave-cert' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await screen.findByText('Configuración guardada.');
  expect(apiClient.put).toHaveBeenCalledWith('/invoices/config', { cert_base64: 'dGVzdA==', cert_password: 'clave-cert' });
  expect((screen.getByLabelText('Certificado digital PKCS#12') as HTMLInputElement).value).toBe('');
  client.clear();
});
it.each([[400, 'ISSUER_SOL_GROUP_INCOMPLETE', /ingrese usuario y contraseña juntos/], [401, 'Unauthorized', /sesión ha caducado/], [403, 'Forbidden', /Solo un administrador/]] as const)('muestra error HTTP %s del back', async (status, message, texto) => {
  const client = mount(); await screen.findByLabelText('Usuario SOL');
  vi.mocked(apiClient.put).mockRejectedValue(new AxiosError('error', String(status), undefined, undefined,
    { status, statusText: 'error', data: { message }, headers: {}, config: { headers: new AxiosHeaders() } }));
  fireEvent.change(screen.getByLabelText('Usuario SOL'), { target: { value: 'NUEVO' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(texto));
  client.clear();
});
it.each([['INVALIDO', 'Inválido'], ['AUN_NO_VIGENTE', 'Aún no vigente']] as const)('presenta %s con causa y origen efectivos', (estado, etiqueta) => {
  render(<InvoiceIssuerConfigForm config={{ ...config, certificado: {
    archivo: null, configurado: false, estado, vence_el: null, dias_restantes: null, origen: 'deployment',
    causa: 'RUC_NO_COINCIDE', detalle: 'RUC no coincide: empresa 20614142503; certificado 20601234567',
  } }} ruc={config.ruc} guardar={vi.fn()} />);
  expect(screen.getByText(etiqueta)).toBeTruthy();
  expect(screen.getByText('Origen: Respaldo del despliegue')).toBeTruthy();
  expect(screen.getByText(/RUC no coincide: empresa 20614142503; certificado 20601234567/)).toBeTruthy();
});
it('edita los datos fiscales reales sin enviar secretos ni valores por defecto', async () => {
  const guardar = vi.fn().mockResolvedValue(undefined);
  render(<InvoiceIssuerConfigForm config={config} ruc={config.ruc} guardar={guardar} />);
  expect((screen.getByLabelText('Local anexo (Catálogo 59)') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Local anexo (Catálogo 59)'), { target: { value: '0007' } });
  fireEvent.change(screen.getByLabelText('Domicilio fiscal'), { target: { value: 'Domicilio de prueba 123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await waitFor(() => expect(guardar).toHaveBeenCalledWith({ local_anexo: '0007', domicilio_fiscal: 'Domicilio de prueba 123' }));
});
