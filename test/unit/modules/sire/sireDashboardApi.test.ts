import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENV } from '@/config/env.config';
import { useAuthStore } from '@/stores/authStore';
import { sireDashboardApi } from '@/modules/sire/services/sireDashboardApi';

const metricResponse = {
  state: 'CLOSED',
  recentFailedCalls: 0,
  failureRate: 1,
  slowCallRate: 2,
  bufferedInvoicesCount: 0,
  totalCalls: 10,
  successfulCalls: 9,
  failedCalls: 1,
  totalRetries: 2,
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sireDashboardApi', () => {
  it('fetches metrics with a Bearer token and without a company identifier', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(metricResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sireDashboardApi.getMetrics()).resolves.toEqual(metricResponse);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV.VITE_API_URL}/sire/dashboard/metrics`);
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer session-token');
    expect(new Headers(options.headers).has('X-Tenant-Id')).toBe(false);
    expect(options.body).toBeUndefined();
  });

  it('sends the requested ISO range, granularity and pagination for history', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: [], pagination: { limit: 24, offset: 48, hasMore: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sireDashboardApi.getHistory({
      start: '2026-10-29T00:00:00.000Z',
      end: '2026-10-30T00:00:00.000Z',
      granularity: 'hour',
      limit: 24,
      offset: 48,
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url, 'http://localhost');
    expect(url.startsWith(`${ENV.VITE_API_URL}/sire/dashboard/history`)).toBe(true);
    expect(parsedUrl.searchParams.get('start')).toBe('2026-10-29T00:00:00.000Z');
    expect(parsedUrl.searchParams.get('end')).toBe('2026-10-30T00:00:00.000Z');
    expect(parsedUrl.searchParams.get('granularity')).toBe('hour');
    expect(parsedUrl.searchParams.get('limit')).toBe('24');
    expect(parsedUrl.searchParams.get('offset')).toBe('48');
    expect(parsedUrl.searchParams.has('companyId')).toBe(false);
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer session-token');
  });

  it('surfaces API errors instead of returning success-shaped empty data', async () => {
    useAuthStore.setState({ token: 'session-token' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ message: 'Servicio no disponible' }),
    }));

    await expect(sireDashboardApi.getMetrics()).rejects.toMatchObject({
      name: 'SireApiError',
      status: 503,
      message: expect.stringContaining('Servicio no disponible'),
    });
  });

  it('warns in development when the dashboard endpoint returns 404', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ message: 'Cannot GET' }),
    }));

    await expect(sireDashboardApi.getMetrics()).rejects.toMatchObject({ status: 404 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/sire/dashboard/metrics'),
    );
  });
});
