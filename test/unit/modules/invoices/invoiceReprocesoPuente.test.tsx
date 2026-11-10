import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceBridgeReprocess } from '@/modules/invoices/components/InvoiceBridgeReprocess';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));
const completo = {
  completo: true,
  yaCompleto: false,
  asientoId: 'venta-039',
  asientoOmitido: true,
  kardex: 'COMPLETO',
  asientoCostoId: 'costo',
  costoVenta: 15,
  movimientosRegistrados: 1,
  movimientosOmitidos: 0,
  errores: [],
};
beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'a', email: 'a@test.com', role: 'ADMIN' },
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useAuthStore.setState({ user: null });
});
it.each(['ACEPTADO', 'OBSERVADO'])(
  'ADMIN puede recuperar %s y ve el costo sin otra llamada de envío o consulta SUNAT',
  async (estado) => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: completo });
    render(<InvoiceBridgeReprocess id="inv-64" estado={estado} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar puente' }));
    expect(await screen.findByText('Puente completado.')).toBeTruthy();
    expect(screen.getByText('Asiento de costo: costo · S/ 15.00')).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
      '/invoices/inv-64/reprocesar-puente',
    );
  },
);
it('ya completo se distingue de haber creado los efectos en esta pasada', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { ...completo, yaCompleto: true, movimientosRegistrados: 0 },
  });
  render(<InvoiceBridgeReprocess id="inv-64" estado="ACEPTADO" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reprocesar puente' }));
  expect(await screen.findByText('El puente ya estaba completo.')).toBeTruthy();
});
it('muestra el motivo si sigue pendiente y permite nuevo reproceso tras corregir la capa', async () => {
  vi.mocked(apiClient.post)
    .mockResolvedValueOnce({
      data: {
        ...completo,
        completo: false,
        kardex: 'PENDIENTE',
        errores: ['Kardex: falta capa FIFO'],
      },
    })
    .mockResolvedValueOnce({ data: completo });
  render(<InvoiceBridgeReprocess id="inv-64" estado="ACEPTADO" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reprocesar puente' }));
  expect(await screen.findByText('El puente sigue pendiente.')).toBeTruthy();
  expect(screen.getByText('Kardex: falta capa FIFO')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reprocesar puente' }));
  expect(await screen.findByText('Puente completado.')).toBeTruthy();
});
it('evita doble clic mientras espera y muestra el fallo HTTP sin salir del detalle', async () => {
  let rechazar!: (reason: unknown) => void;
  vi.mocked(apiClient.post).mockReturnValue(
    new Promise((_resolve, reject) => {
      rechazar = reject;
    }),
  );
  render(<InvoiceBridgeReprocess id="inv-64" estado="ACEPTADO" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reprocesar puente' }));
  const button = screen.getByRole('button', {
    name: 'Reprocesando puente…',
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  rechazar({ response: { data: { message: 'Solo se admiten aceptados' } } });
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Solo se admiten aceptados',
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Reprocesar puente',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
it.each([
  'PENDIENTE',
  'EN_COLA',
  'ERROR_RED',
  'ENVIADO',
  'RECHAZADO',
  'ANULADO',
])('no ofrece reproceso para %s', (estado) => {
  render(<InvoiceBridgeReprocess id="inv-64" estado={estado} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it.each(['CONTADOR', 'AUDITOR', 'OPERATOR'] as const)(
  'oculta la acción al rol %s',
  (role) => {
    useAuthStore.setState({ user: { id: 'u', email: 'u@test.com', role } });
    render(<InvoiceBridgeReprocess id="inv-64" estado="ACEPTADO" />);
    expect(screen.queryByRole('button')).toBeNull();
  },
);
