import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SireHealthDashboard } from '@/modules/sire/components/SireHealthDashboard';
import { sireDashboardApi } from '@/modules/sire/services/sireDashboardApi';
import { SireApiError } from '@/modules/sire/services/sireApi';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const metrics = {
  state: 'CLOSED' as const,
  recentFailedCalls: 1,
  failureRate: 2,
  slowCallRate: 0,
  bufferedInvoicesCount: 1,
  totalCalls: 15,
  successfulCalls: 14,
  failedCalls: 1,
  totalRetries: 3,
  lastStateChange: '2026-10-29T10:00:00Z',
  mttd: null,
  mttr: 120,
  mtbf: null,
  circuitBreakerScope: 'global',
  activityScope: 'company',
  mttdSeconds: null,
  mttrSeconds: 120,
  mtbfSeconds: null,
};

const emptyHistory = { points: [], limit: 24, offset: 0, hasMore: false };

const renderDashboard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SireHealthDashboard />
    </QueryClientProvider>,
  );
  return queryClient;
};

describe('SireHealthDashboard', () => {
  it('shows loading state without hiding SIRE', () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockReturnValue(new Promise(() => {}));
    vi.spyOn(sireDashboardApi, 'getHistory').mockReturnValue(new Promise(() => {}));
    const queryClient = renderDashboard();
    expect(screen.getByRole('region', { name: 'Dashboard de conexión SIRE' })).toBeInTheDocument();
    expect(screen.getByText('Cargando métricas SIRE…')).toBeInTheDocument();
    queryClient.clear();
  });

  it('shows an explicit API error and preserves the rest of SIRE', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockRejectedValue(new Error('unavailable'));
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    expect(await screen.findByText('No se pudo cargar el estado de conexión')).toBeInTheDocument();
    expect(screen.getByText(/La conciliación sigue disponible/)).toBeInTheDocument();
    expect(screen.getByText('NO DISPONIBLE')).toBeInTheDocument();
    queryClient.clear();
  });

  it('hides the complete panel when metrics are not implemented yet', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockRejectedValue(new SireApiError('Not found', 404));
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Dashboard de conexión SIRE' })).not.toBeInTheDocument();
    });
    queryClient.clear();
  });

  it('hides the complete panel when history is not implemented yet', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue(metrics);
    vi.spyOn(sireDashboardApi, 'getHistory').mockRejectedValue(new SireApiError('Not found', 404));
    const queryClient = renderDashboard();
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Dashboard de conexión SIRE' })).not.toBeInTheDocument();
    });
    queryClient.clear();
  });

  it('keeps the panel visible for server errors other than 404', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockRejectedValue(new SireApiError('Server error', 500));
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    expect(await screen.findByRole('region', { name: 'Dashboard de conexión SIRE' })).toBeInTheDocument();
    expect(await screen.findByText('No se pudo cargar el estado de conexión')).toBeInTheDocument();
    queryClient.clear();
  });

  it('shows the circuit-open red status using the API state', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue({ ...metrics, state: 'OPEN' });
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    expect(await screen.findByText('Rojo · 5 o más errores o circuito abierto')).toBeInTheDocument();
    expect(screen.getByText('El circuito abierto activa el estado rojo.')).toBeInTheDocument();
    queryClient.clear();
  });

  it('does not mistake aggregate call counters for the recent error count', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue(metrics);
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    expect(await screen.findByText('Ámbar · 1 a 4 errores en los últimos 5 minutos')).toBeInTheDocument();
    expect(await screen.findAllByText('No disponible')).toHaveLength(2);
    expect(screen.getByText('Reintentos totales').parentElement).toHaveTextContent('3');
    queryClient.clear();
  });

  it('shows the explicit no-recent-errors green threshold from the metrics API', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue({ ...metrics, recentFailedCalls: 0 });
    vi.spyOn(sireDashboardApi, 'getHistory').mockResolvedValue(emptyHistory);
    const queryClient = renderDashboard();
    expect(await screen.findByText('Verde · 0 errores en los últimos 5 minutos')).toBeInTheDocument();
    queryClient.clear();
  });

  it('shows API errors for the history query without removing charts', async () => {
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue(metrics);
    vi.spyOn(sireDashboardApi, 'getHistory').mockRejectedValue(new Error('history unavailable'));
    const queryClient = renderDashboard();
    expect(await screen.findByText('No se pudo cargar el historial de resiliencia')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Historial de reintentos y disponibilidad' })).toBeInTheDocument();
    queryClient.clear();
  });

  it('uses the server limit and hasMore flag for history pagination', async () => {
    const historySpy = vi.spyOn(sireDashboardApi, 'getHistory')
      .mockResolvedValueOnce({ points: [], limit: 12, offset: 0, hasMore: true })
      .mockResolvedValueOnce({ points: [], limit: 12, offset: 12, hasMore: false });
    vi.spyOn(sireDashboardApi, 'getMetrics').mockResolvedValue(metrics);
    const queryClient = renderDashboard();
    const nextButton = await screen.findByRole('button', { name: 'Siguiente' });
    await waitFor(() => expect(nextButton).toBeEnabled());
    fireEvent.click(nextButton);
    await waitFor(() => {
      expect(historySpy).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 12, offset: 12 }));
    });
    queryClient.clear();
  });
});
