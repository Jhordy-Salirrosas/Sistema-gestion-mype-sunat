import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { apiClient } from '@/lib/axios';
import { useRucAutofill } from '@/modules/invoices/hooks/useRucAutofill';
import { consultarRuc, type DatosRuc } from '@/modules/invoices/services/rucApi';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
const ruc = '20100070970';
const datos: DatosRuc = { ruc, razonSocial: 'RECEPTOR SAC', direccionFiscal: 'Av. Receptor 123', ubigeo: '150101', estadoContribuyente: 'ACTIVO', condicionDomicilio: 'HABIDO' };
const respuesta = (data = datos) => ({ data });
const avanzar = () => act(async () => { await vi.advanceTimersByTimeAsync(300); });
beforeEach(() => { vi.useFakeTimers(); vi.mocked(apiClient.get).mockResolvedValue(respuesta()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

describe('consulta RUC autenticada y autorrelleno', () => {
  it('usa el cliente HTTP común y el contrato real de receptor', async () => {
    expect(await consultarRuc(ruc)).toEqual(datos);
    expect(apiClient.get).toHaveBeenCalledWith('/sunat/ruc/20100070970');
  });
  it.each([{ ...datos, ruc: '20131312955' }, { ...datos, razonSocial: '' }, { ...datos, razonSocial: undefined }])('rechaza respuestas que no identifican al receptor: %j', async data => {
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(consultarRuc(ruc)).rejects.toThrow('Respuesta RUC inválida');
  });
  it('consulta solo al completar un RUC válido y agrupa cambios rápidos', async () => {
    const recibir = vi.fn(); const { result } = renderHook(() => useRucAutofill(recibir));
    for (const valor of ['', '70123456', '2010007097', '20100070971']) act(() => result.current.consultar(valor));
    await avanzar(); expect(apiClient.get).not.toHaveBeenCalled();
    act(() => result.current.consultar('20131312955'));
    act(() => result.current.consultar(ruc));
    await avanzar(); expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(recibir).toHaveBeenCalledWith(datos); expect(result.current.aviso).toContain('Puede editar');
  });
  it('muestra progreso sin bloquear la edición y descarta éxito fuera de orden', async () => {
    let resolver!: (value: { data: DatosRuc }) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    const recibir = vi.fn(); const { result } = renderHook(() => useRucAutofill(recibir));
    act(() => result.current.consultar(ruc)); await avanzar(); expect(result.current.aviso).toContain('Consultando');
    act(() => result.current.consultar('20131312955')); await avanzar();
    await act(async () => resolver(respuesta()));
    expect(recibir).toHaveBeenCalledTimes(0); // La segunda respuesta tiene el RUC anterior: se rechaza.
    expect(result.current.aviso).toContain('manualmente');
  });
  it('la corrección manual prevalece sobre una respuesta pendiente', async () => {
    let resolver!: (value: { data: DatosRuc }) => void;
    vi.mocked(apiClient.get).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
    const recibir = vi.fn(); const { result } = renderHook(() => useRucAutofill(recibir));
    act(() => result.current.consultar(ruc)); await avanzar(); act(() => result.current.cancelar());
    await act(async () => resolver(respuesta())); expect(recibir).not.toHaveBeenCalled(); expect(result.current.aviso).toBe('');
  });
  it.each([new Error('offline'), { response: { status: 404 } }, { response: { status: 503 } }])('deja modo manual ante error o RUC ausente: %j', async error => {
    vi.mocked(apiClient.get).mockRejectedValue(error);
    const recibir = vi.fn(); const { result } = renderHook(() => useRucAutofill(recibir));
    act(() => result.current.consultar(ruc)); await avanzar(); expect(recibir).not.toHaveBeenCalled(); expect(result.current.aviso).toContain('manualmente');
  });
  it('informa dirección ausente sin inventarla', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(respuesta({ ...datos, direccionFiscal: null }));
    const recibir = vi.fn(); const { result } = renderHook(() => useRucAutofill(recibir));
    act(() => result.current.consultar(ruc)); await avanzar(); expect(recibir).toHaveBeenCalledWith({ ...datos, direccionFiscal: null }); expect(result.current.aviso).toContain('no informó dirección');
  });
  it('descarta un error tardío tras edición y no consulta al desmontarse antes del debounce', async () => {
    let rechazar!: (error: Error) => void;
    vi.mocked(apiClient.get).mockReturnValue(new Promise((_resolve, reject) => { rechazar = reject; }));
    const { result, unmount } = renderHook(() => useRucAutofill(vi.fn()));
    act(() => result.current.consultar(ruc)); await avanzar(); act(() => result.current.cancelar());
    await act(async () => rechazar(new Error('tardío'))); expect(result.current.aviso).toBe('');
    act(() => result.current.consultar(ruc)); unmount(); await avanzar(); expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
  it('descarta una respuesta pendiente al desmontarse', async () => {
    let resolver!: (value: { data: DatosRuc }) => void;
    vi.mocked(apiClient.get).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
    const recibir = vi.fn(); const { result, unmount } = renderHook(() => useRucAutofill(recibir));
    act(() => result.current.consultar(ruc)); await avanzar(); unmount();
    await act(async () => resolver(respuesta())); expect(recibir).not.toHaveBeenCalled();
  });
});
