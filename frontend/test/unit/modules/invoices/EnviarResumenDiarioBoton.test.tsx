import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
/**
 * D11 · envío del resumen diario de boletas.
 *
 * El docente pidió poder informar las boletas del día. El backend ya sabía
 * (`POST /resumenes/diario/enviar` firma y encola), pero el front solo mostraba
 * la vista previa y no tenía botón.
 *
 * Lo que estas pruebas protegen:
 *  - Que el botón NO se ofrezca cuando no hay nada que enviar.
 *  - Que pida confirmación: un RC es un acto ante SUNAT y no se deshace.
 *  - Que diga la verdad del contrato: se ENCOLA, SUNAT devuelve un TICKET y el
 *    CDR llega después. NUNCA "aceptado".
 *  - Que muestre LITERAL el motivo cuando el backend decide no enviar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnviarResumenDiarioBoton } from '@/modules/invoices/components/EnviarResumenDiarioBoton';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({
  invoicesApi: { enviarResumenDiario: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const props = (parcial: Partial<Parameters<typeof EnviarResumenDiarioBoton>[0]> = {}) => ({
  fecha: '2026-11-03',
  identificador: 'RC-20261103-001',
  incluidos: 2,
  puedeEnviar: true,
  onEnviado: vi.fn(),
  ...parcial,
});

describe('D11 · botón de envío del resumen diario', () => {
  it('sin líneas no ofrece el envío', () => {
    render(
      <EnviarResumenDiarioBoton
        {...props({ puedeEnviar: false, incluidos: 1 })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /Enviar resumen diario/i }),
    ).toBeNull();
    expect(
      screen.getByText(/No hay líneas que informar/i),
    ).toBeDefined();
  });

  it('si NINGUNA es elegible, explica las exclusiones sin atribuir CDR a todos', () => {
    // D11: cuando todas las boletas del día ya están informadas, el envío se
    // inhabilita CON explicación. Callarse haría pensar que el día está vacío.
    render(
      <EnviarResumenDiarioBoton
        {...props({ puedeEnviar: false, incluidos: 0 })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /Enviar resumen diario/i }),
    ).toBeNull();
    const texto = screen.getByText(/No hay boletas elegibles para RC/i);
    expect(texto.textContent).toContain('transporte incierto');
    expect(texto.textContent).toContain('canal individual en curso');
    expect(texto.textContent).toContain('deshabilitado');
  });

  it('con líneas ofrece el botón sin enviar nada todavía', () => {
    render(<EnviarResumenDiarioBoton {...props()} />);

    expect(
      screen.getByRole('button', { name: /Enviar resumen diario/i }),
    ).toBeDefined();
    // Pulsar NO envía: primero se confirma.
    expect(invoicesApi.enviarResumenDiario).not.toHaveBeenCalled();
  });

  it('pide confirmación antes de enviar, diciendo cuántos van', () => {
    render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));

    expect(screen.getByText(/Confirmar envío de RC-20261103-001/)).toBeDefined();
    expect(screen.getByText(/Se enviarán 2 comprobante\(s\)/)).toBeDefined();
    expect(invoicesApi.enviarResumenDiario).not.toHaveBeenCalled();
  });

  it('cancelar no envía', () => {
    render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

    expect(invoicesApi.enviarResumenDiario).not.toHaveBeenCalled();
  });

  it('confirmar llama al endpoint con la fecha', async () => {
    vi.mocked(invoicesApi.enviarResumenDiario).mockResolvedValue({
      enviado: true,
      identificador: 'RC-20261103-001',
      jobId: 'job-1',
      incluidos: 2,
      motivo: null,
    });

    render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, enviar ahora/i }));

    await waitFor(() =>
      expect(invoicesApi.enviarResumenDiario).toHaveBeenCalledWith('2026-11-03'),
    );
  });

  it('tras encolar dice TICKET, NUNCA "aceptado"', async () => {
    vi.mocked(invoicesApi.enviarResumenDiario).mockResolvedValue({
      enviado: true,
      identificador: 'RC-20261103-001',
      jobId: 'job-1',
      incluidos: 2,
      motivo: null,
    });

    const { container } = render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, enviar ahora/i }));

    await waitFor(() => expect(screen.getByText('Enviado a la cola')).toBeDefined());

    const texto = (container.textContent ?? '').toLowerCase();
    // Inventar un CDR fue el defecto que se corrigió en la emisión individual.
    expect(texto).not.toContain('aceptado');
    expect(texto).toContain('ticket');
    expect(texto).toContain('cdr');
  });

  it('si el backend decide no enviar, muestra SU motivo literal', async () => {
    vi.mocked(invoicesApi.enviarResumenDiario).mockResolvedValue({
      enviado: false,
      identificador: 'RC-20261103-001',
      jobId: null,
      incluidos: 0,
      motivo: 'No hay comprobantes que informar en la fecha indicada.',
    });

    render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, enviar ahora/i }));

    await waitFor(() => expect(screen.getByText('No se envió')).toBeDefined());
    expect(
      screen.getByText(/No hay comprobantes que informar/),
    ).toBeDefined();
  });

  it('un fallo de red NO se presenta como envío exitoso', async () => {
    vi.mocked(invoicesApi.enviarResumenDiario).mockRejectedValue(
      new Error('Network Error'),
    );

    render(<EnviarResumenDiarioBoton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, enviar ahora/i }));

    await waitFor(() => expect(screen.getByText('No se envió')).toBeDefined());
    expect(screen.queryByText('Enviado a la cola')).toBeNull();
  });

  it('solo refresca la vista cuando de verdad se encoló', async () => {
    const onEnviado = vi.fn();
    vi.mocked(invoicesApi.enviarResumenDiario).mockResolvedValue({
      enviado: false,
      identificador: 'RC-20261103-001',
      jobId: null,
      incluidos: 0,
      motivo: 'Nada que informar.',
    });

    render(<EnviarResumenDiarioBoton {...props({ onEnviado })} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar resumen diario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, enviar ahora/i }));

    await waitFor(() => expect(screen.getByText('No se envió')).toBeDefined());
    expect(onEnviado).not.toHaveBeenCalled();
  });
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
