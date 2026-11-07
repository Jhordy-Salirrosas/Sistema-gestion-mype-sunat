import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ENV } from '@/config/env.config';
import SireClosurePage from '@/modules/sire/pages/SireClosurePage';
import SireHistoryPage from '@/modules/sire/pages/SireHistoryPage';
import { sireApi } from '@/modules/sire/services/sireApi';
import { useAuthStore } from '@/stores/authStore';
import { useSireReconciliationStore } from '@/modules/sire/stores/sireReconciliationStore';

const summary = {
  total: 1,
  coincidenciaExacta: 1,
  diferenciaMontos: 0,
  omisionLocal: 0,
  omisionSunat: 0,
  duplicadoLlave: 0,
  porcentajeCumplimiento: 100,
};

beforeEach(() => {
  useAuthStore.setState({ token: 'test-access-token' });
  useSireReconciliationStore.getState().clearSummary();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SIRE lifecycle', () => {
  it('sends the close request to the backend and confirms the closed state', async () => {
    useSireReconciliationStore.getState().setSummary('202610', 'RVIE_VENTAS', summary);
    vi.stubGlobal('confirm', vi.fn(() => true));
    const closeSpy = vi.spyOn(sireApi, 'closePeriod').mockResolvedValue({
      period: '202610',
      bookType: 'RVIE_VENTAS',
      status: 'CERRADO',
    });

    render(
      <MemoryRouter>
        <SireClosurePage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar periodo' }));

    expect(await screen.findByText('El periodo 202610 quedó cerrado correctamente y aparecerá en el historial.')).toBeInTheDocument();
    expect(closeSpy).toHaveBeenCalledWith('202610', 'RVIE_VENTAS');
    expect(useSireReconciliationStore.getState().isClosed).toBe(true);
  });

  it('loads the closed periods from the backend and shows their summary', async () => {
    const historySpy = vi.spyOn(sireApi, 'getHistory').mockResolvedValue({
      page: 1,
      limit: 20,
      total: 1,
      items: [{
        id: 'history-1',
        period: '202610',
        bookType: 'RVIE',
        status: 'CERRADO',
        createdAt: '2026-11-01T00:00:00.000Z',
        complianceRate: 100,
        totalsByScenario: {
          COINCIDENCIA_EXACTA: 1,
          DIFERENCIA_MONTOS: 0,
          OMISION_LOCAL: 0,
          OMISION_SUNAT: 0,
          DUPLICADO_LLAVE: 0,
        },
      }],
    });

    render(
      <MemoryRouter>
        <SireHistoryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('RVIE · Ventas')).toBeInTheDocument();
    expect(screen.getByText('202610')).toBeInTheDocument();
    expect(screen.getByText('100.00%')).toBeInTheDocument();
    expect(historySpy).toHaveBeenCalledWith(1, 20);
  });

  it('uses the authenticated API routes for close and history', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          period: '202610',
          bookType: 'RCE_COMPRAS',
          status: 'CERRADO',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ page: 2, limit: 10, total: 11, items: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sireApi.closePeriod('202610', 'RCE_COMPRAS')).resolves.toMatchObject({
      status: 'CERRADO',
    });
    await expect(sireApi.getHistory(2, 10)).resolves.toMatchObject({
      page: 2,
      total: 11,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${ENV.VITE_API_URL}/sire/close`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      period: '202610',
      bookType: 'RCE_COMPRAS',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`${ENV.VITE_API_URL}/sire/history?page=2&limit=10`);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer test-access-token');
  });
});
