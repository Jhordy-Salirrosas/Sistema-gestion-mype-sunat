import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENV } from '@/config/env.config';
import { useAuthStore } from '@/stores/authStore';
import { sireApi } from '@/modules/sire/services/sireApi';

const request = {
  period: '202611',
  bookType: 'RCE_COMPRAS' as const,
  proposalId: 'proposal-001',
  reason: 'Duplicado',
};

const response = {
  period: request.period,
  bookType: 'RCE',
  state: 'PROPUESTA',
  count: 1,
  proposals: [{
    id: 'proposal-001',
    period: request.period,
    bookType: 'RCE',
    carSunat: 'CAR-MOCK-001',
    emitterRuc: '20123456789',
    documentType: '01',
    series: 'F001',
    correlative: '001',
    issueDate: '2026-11-15T00:00:00.000Z',
    taxableBase: 100,
    igvAmount: 18,
    totalAmount: 118,
    origin: 'SUNAT',
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

const stubSuccess = (body: unknown = response) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('sireApi workflow contracts', () => {
  it('posts period and bookType for the proposal and maps backend id to proposalId', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess();

    const result = await sireApi.getProposal(request);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV.VITE_API_URL}/sire/proposal`);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({ period: request.period, bookType: request.bookType });
    expect(JSON.parse(options.body as string)).not.toHaveProperty('companyId');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer session-token');
    expect(result.records?.[0]).toMatchObject({
      proposalId: 'proposal-001',
      emitterRuc: '20123456789',
      totalAmount: 118,
    });
  });

  it('sends proposalId and period information to exclusion actions', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess({ ...response, proposals: [] });

    await sireApi.exclude(request);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV.VITE_API_URL}/sire/excluir`);
    expect(JSON.parse(options.body as string)).toEqual({
      proposalId: request.proposalId,
      period: request.period,
      bookType: request.bookType,
      reason: request.reason,
    });
  });

  it('polls the selected period through the ticket route with bookType in the query', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess({ period: request.period, bookType: 'RCE', state: 'ERROR', status: 'ERROR' });

    const result = await sireApi.pollTicket(request);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url, 'http://localhost');
    expect(parsedUrl.pathname).toBe('/api/v1/sire/tickets/202611/poll');
    expect(parsedUrl.searchParams.get('bookType')).toBe(request.bookType);
    expect(options.method).toBe('POST');
    expect(result.status).toBe('ERROR');
  });

  it('uses periodo/libro for preliminary and generated reads, and uploads CSV reports multipart', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess({ ...response, proposals: [] });

    await sireApi.getPreliminary(request);
    await sireApi.getGenerated(request);
    await sireApi.uploadReport({
      period: request.period,
      bookType: request.bookType,
      file: new File(['report'], 'report.csv', { type: 'text/csv' }),
    });

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe(`${ENV.VITE_API_URL}/sire/preliminar?periodo=202611&libro=RCE_COMPRAS`);
    expect(calls[1][0]).toBe(`${ENV.VITE_API_URL}/sire/generado?periodo=202611&libro=RCE_COMPRAS`);
    expect(calls[2][0]).toBe(`${ENV.VITE_API_URL}/sire/upload`);
    expect(calls[2][1].body).toBeInstanceOf(FormData);
    expect((calls[2][1].body as FormData).get('file')).toBeInstanceOf(File);
    expect(new Headers(calls[2][1].headers).get('Content-Type')).toBeNull();
  });

  it('uploads files as multipart without overriding the browser boundary', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess({ imported: 1, rejected: 0, errors: [] });
    const file = new File(['record'], 'records.txt', { type: 'text/plain' });

    await sireApi.importProposal({ period: request.period, bookType: request.bookType }, file);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV.VITE_API_URL}/sire/import`);
    expect(options.body).toBeInstanceOf(FormData);
    expect(new Headers(options.headers).get('Content-Type')).toBeNull();
    expect((options.body as FormData).get('period')).toBe(request.period);
    expect((options.body as FormData).get('bookType')).toBe(request.bookType);
  });

  it('uses the confirmed accept, preliminary delete, generation, and replacement contracts', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = stubSuccess({ ...response, proposals: [] });

    await sireApi.acceptProposal({ period: request.period, bookType: request.bookType, confirmed: true });
    await sireApi.removePreliminaryRecord(request);
    await sireApi.generate(request);
    await sireApi.replaceProposal({
      period: request.period,
      bookType: request.bookType,
      file: new File(['record'], 'replace.txt', { type: 'text/plain' }),
    });

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      `${ENV.VITE_API_URL}/sire/aceptar`,
      `${ENV.VITE_API_URL}/sire/preliminary`,
      `${ENV.VITE_API_URL}/sire/generate`,
      `${ENV.VITE_API_URL}/sire/proposal/replace`,
    ]);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      period: request.period,
      bookType: request.bookType,
      confirmed: true,
    });
    expect(JSON.parse(calls[1][1].body as string)).toEqual({
      period: request.period,
      bookType: request.bookType,
      proposalId: request.proposalId,
    });
    expect(JSON.parse(calls[2][1].body as string)).toEqual({
      period: request.period,
      bookType: request.bookType,
    });
    expect(calls[3][1].body).toBeInstanceOf(FormData);
    expect(new Headers(calls[3][1].headers).get('Content-Type')).toBeNull();
  });

  it('clears the session and redirects when the backend returns 401', async () => {
    useAuthStore.setState({ token: 'expired-token' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sireApi.getProposal(request)).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().token).toBeNull();
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toContain('reason=session-expired');
  });

  it('rejects invalid periods and unsupported file extensions before making a request', async () => {
    useAuthStore.setState({ token: 'session-token' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sireApi.getProposal({ ...request, period: '202613' })).rejects.toThrow('periodo válido');
    await expect(sireApi.importProposal(
      { period: request.period, bookType: request.bookType },
      new File(['x'], 'records.xml'),
    )).rejects.toThrow('archivo TXT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
