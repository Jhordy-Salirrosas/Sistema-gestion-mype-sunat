import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ENV } from '@/config/env.config';
import SireImportPage from '@/modules/sire/pages/SireImportPage';
import { sireApi, SireApiError } from '@/modules/sire/services/sireApi';
import { useAuthStore } from '@/stores/authStore';

const importResult = {
  imported: 2,
  rejected: 1,
  errors: [{ line: 3, reason: 'Fecha, monto o CAR inválido.' }],
};

beforeEach(() => {
  useAuthStore.setState({ token: 'test-access-token' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sireApi.importProposal', () => {
  it('envía archivo, periodo y libro como multipart sin fijar Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue(importResult),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['row'], 'proposal.txt', { type: 'text/plain' });

    await expect(sireApi.importProposal({ period: '202610', bookType: 'RVIE_VENTAS' }, file)).resolves.toEqual(
      importResult,
    );

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV.VITE_API_URL}/sire/import`);
    expect(request.method).toBe('POST');
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer test-access-token');
    expect(new Headers(request.headers).has('Content-Type')).toBe(false);
    expect((request.body as FormData).get('file')).toBe(file);
    expect((request.body as FormData).get('period')).toBe('202610');
    expect((request.body as FormData).get('bookType')).toBe('RVIE_VENTAS');
  });

  it('muestra el motivo del backend cuando el archivo es rechazado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          message: 'Solo se permiten archivos .txt.',
        }),
      }),
    );

    await expect(
      sireApi.importProposal(
        { period: '202610', bookType: 'RCE_COMPRAS' },
        new File(['row'], 'proposal.txt', { type: 'text/plain' }),
      ),
    ).rejects.toMatchObject({
      name: 'SireApiError',
      status: 400,
      message: expect.stringContaining('Solo se permiten archivos .txt.'),
    });
  });

  it('explica cuando el backend desplegado no expone la ruta de importación', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({}),
      }),
    );

    await expect(
      sireApi.importProposal(
        { period: '202610', bookType: 'RVIE_VENTAS' },
        new File(['row'], 'proposal.txt', { type: 'text/plain' }),
      ),
    ).rejects.toThrow('No se encontró el recurso o periodo SIRE solicitado.');
  });

  it('no hace la petición si no hay sesión autenticada', async () => {
    useAuthStore.setState({ token: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sireApi.importProposal(
        { period: '202610', bookType: 'RVIE_VENTAS' },
        new File(['row'], 'proposal.txt', { type: 'text/plain' }),
      ),
    ).rejects.toBeInstanceOf(SireApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SireImportPage', () => {
  it('permite importar y muestra las filas procesadas y rechazadas', async () => {
    const importSpy = vi.spyOn(sireApi, 'importProposal').mockResolvedValue(importResult);
    render(
      <MemoryRouter>
        <SireImportPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Periodo fiscal (YYYYMM)'), {
      target: { value: '202610' },
    });
    fireEvent.change(screen.getByLabelText('Libro'), {
      target: { value: 'RCE_COMPRAS' },
    });
    fireEvent.change(screen.getByLabelText('Archivo TXT provisional'), {
      target: {
        files: [new File(['row'], 'proposal.txt', { type: 'text/plain' })],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar propuesta' }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith({ period: '202610', bookType: 'RCE_COMPRAS' }, expect.any(File));
    });
    expect(await screen.findByText('Importación completada')).toBeInTheDocument();
    expect(screen.getByText(/Se importaron 2 filas y se rechazaron 1/)).toBeInTheDocument();
    expect(screen.getByText('Línea 3: Fecha, monto o CAR inválido.')).toBeInTheDocument();
    expect(screen.getByText(/no el layout oficial SUNAT/)).toBeInTheDocument();
  });

  it('valida el periodo antes de llamar al backend', async () => {
    const importSpy = vi.spyOn(sireApi, 'importProposal');
    render(
      <MemoryRouter>
        <SireImportPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Periodo fiscal (YYYYMM)'), {
      target: { value: '202613' },
    });
    fireEvent.change(screen.getByLabelText('Archivo TXT provisional'), {
      target: {
        files: [new File(['row'], 'proposal.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importar propuesta' }));

    expect(await screen.findByText('Ingresa un periodo válido con formato YYYYMM.')).toBeInTheDocument();
    expect(importSpy).not.toHaveBeenCalled();
  });
});
