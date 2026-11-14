import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceSendAgeAlert } from '@/modules/invoices/components/InvoiceSendAgeAlert';
import { ALERTAS_VACIAS, normalizarAlertas, type AlertaAntiguedadEnvio } from '@/modules/invoices/lib/invoiceAlertas';
import InvoiceMonitorPage from '@/modules/invoices/pages/InvoiceMonitorPage';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/lib/offlineCache', () => ({ cachedGet: (_key: string, read: () => unknown) => read() }));
vi.mock('@/modules/invoices/components/InvoiceAggregateMonitor', () => ({ InvoiceAggregateMonitor: () => null }));
const antiguedad: AlertaAntiguedadEnvio = { evaluado: true, gravedad: 'CRITICO', mensaje: '1 comprobante pendiente de envío.', documentos: [{ id: 'plazo', numero: 'B001-00000999', tipoComprobante: '03', estado: 'ERROR_RED', fechaEmision: '2026-11-01', fechaLimite: '2026-11-08', diasRestantes: -1 }] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('normaliza la alerta nueva y conserva compatibilidad con la respuesta anterior', () => {
  expect(normalizarAlertas(ALERTAS_VACIAS).antiguedad).toBeUndefined();
  expect(normalizarAlertas({ ...ALERTAS_VACIAS, antiguedad })).toMatchObject({ antiguedad, gravedadGlobal: 'CRITICO' });
  expect(normalizarAlertas({ antiguedad: { ...antiguedad, documentos: null } } as never).antiguedad?.documentos).toEqual([]);
});
it('muestra fecha límite y vencimiento sin controles de reenvío', () => {
  render(<InvoiceSendAgeAlert alerta={antiguedad} />);
  expect(screen.getByText('2026-11-08')).toBeTruthy(); expect(screen.getByText('Vencido hace 1 día(s)')).toBeTruthy(); expect(screen.queryByRole('button')).toBeNull();
});
it('la alerta del GET existente se monta en el Monitor real', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/alertas' ? { ...ALERTAS_VACIAS, antiguedad } : { data: [], total: 0, total_pages: 1 } }));
  render(<InvoiceMonitorPage />);
  expect(await screen.findByText('B001-00000999')).toBeTruthy(); expect(screen.getByText('Plazo de envío')).toBeTruthy();
  expect(apiClient.get).toHaveBeenCalledWith('/invoices/alertas');
});
