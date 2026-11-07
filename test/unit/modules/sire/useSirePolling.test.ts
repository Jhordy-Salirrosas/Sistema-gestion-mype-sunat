import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSirePolling } from '@/modules/sire/hooks/useSirePolling';
import { sireApi } from '@/modules/sire/services/sireApi';

const request = {
  period: '202611',
  bookType: 'RCE_COMPRAS' as const,
};

const pending = {
  period: request.period,
  bookType: request.bookType,
  state: 'PROCESANDO_PRELIMINAR' as const,
  ticket: 'TICKET-MOCK-001',
  status: 'PENDIENTE' as const,
  records: [],
  error: null,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSirePolling', () => {
  it('polls every three seconds and stops after TERMINADO', async () => {
    vi.useFakeTimers();
    const statusSpy = vi.spyOn(sireApi, 'pollTicket').mockResolvedValue({
      ...pending,
      state: 'CON_PRELIMINAR',
      status: 'TERMINADO',
    });
    const onComplete = vi.fn();
    const { result } = renderHook(() => useSirePolling(request, pending, onComplete));

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(result.current.current?.status).toBe('TERMINADO');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'TERMINADO' }));

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(statusSpy).toHaveBeenCalledTimes(1);
  });

  it('stops polling and exposes ERROR responses', async () => {
    vi.useFakeTimers();
    vi.spyOn(sireApi, 'pollTicket').mockResolvedValue({
      ...pending,
      state: 'ERROR',
      status: 'ERROR',
      error: { code: 'SUNAT_ERROR', message: 'SUNAT rechazó la operación' },
    });
    const onComplete = vi.fn();
    const { result } = renderHook(() => useSirePolling(request, pending, onComplete));

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(result.current.current?.status).toBe('ERROR');
    expect(result.current.current?.error?.code).toBe('SUNAT_ERROR');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
