import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceBajasPage from '@/modules/invoices/pages/InvoiceBajasPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getVistaResumen: vi.fn(), getVistaBaja: vi.fn(), getVistaAnulacionNotas: vi.fn() } }));
vi.mock('@/modules/invoices/components/EnviarResumenDiarioBoton', () => ({ EnviarResumenDiarioBoton: () => null }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('Bajas: respuestas fuera de orden', () => {
  it('conserva la pestaña elegida al llegar tarde la consulta anterior', async () => {
    let resolver!: (v: unknown) => void;
    vi.mocked(invoicesApi.getVistaResumen).mockReturnValue(new Promise((resolve) => { resolver = resolve as (v: unknown) => void; }));
    const vista = (id: string) => ({ envio: { identificador: id }, errores: [], lineas: [] });
    vi.mocked(invoicesApi.getVistaBaja).mockResolvedValue(vista('RA-ACTUAL') as never);
    render(<InvoiceBajasPage />);
    await waitFor(() => expect(invoicesApi.getVistaResumen).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('tab', { name: /Anulación de comprobante/ }));
    expect(await screen.findByText('RA-ACTUAL')).toBeTruthy();
    await act(async () => resolver(vista('RC-ANTERIOR')));
    expect(screen.queryByText('RC-ANTERIOR')).toBeNull();
    expect(screen.getByText('RA-ACTUAL')).toBeTruthy();
  });
});

it('la pestaña de anulación de notas carga RC separado de las altas y de RA', async () => {
 const v = { envio: { identificador: 'RC-ANULACION', tipo: 'RESUMEN_DIARIO' as const, fechaReferencia: '2026-11-14', correlativo: 1, lineas: 0 }, errores: [], lineas: [], xml: null };
 vi.mocked(invoicesApi.getVistaResumen).mockResolvedValue({ ...v, envio: { ...v.envio, identificador: 'RC-ALTA' } });
 vi.mocked(invoicesApi.getVistaAnulacionNotas).mockResolvedValue(v);
 render(<InvoiceBajasPage />);
 await screen.findByText('RC-ALTA');
 fireEvent.click(screen.getByRole('tab', { name: 'Anulación de notas (RC)' }));
 await screen.findByText('RC-ANULACION');
 expect(invoicesApi.getVistaAnulacionNotas).toHaveBeenCalledTimes(1);
 expect(invoicesApi.getVistaBaja).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Confirmo que estas notas no fueron otorgadas al receptor.')).toBeTruthy();
});
