/**
 * Badge del estado de un comprobante.
 *
 * Lo que se protege aquí es la DEUDA A ya cerrada: que el estado se baste a sí
 * mismo. Antes, para no rotular "Rechazado" un fallo de envío, el badge tenía
 * que recibir el comprobante completo y consultar el estado crudo del backend,
 * porque `EstadoCdrDemo` no tenía forma de representar "no llegó a SUNAT".
 *
 * Ese apaño tenía un techo confesado: cualquier pantalla nueva que pintara el
 * estado sin repetir la comprobación volvía a mentir. Ahora `SIN_CONFIRMAR` es
 * un valor del enum y el badge no necesita saber nada más.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvoiceStatusBadge } from '@/modules/invoices/components/InvoiceStatusBadge';

describe('InvoiceStatusBadge', () => {
  it('rotula un fallo de envío como "Sin confirmar"', () => {
    render(<InvoiceStatusBadge estado="SIN_CONFIRMAR" />);

    expect(screen.getByText('Incertidumbre de transporte')).toBeDefined();
  });

  it('NO confunde un fallo de envío con un rechazo', () => {
    const { container } = render(<InvoiceStatusBadge estado="SIN_CONFIRMAR" />);

    expect(container.textContent).not.toContain('Rechazado');
  });

  it('no usa el rojo destructivo del rechazo para un fallo de envío', () => {
    // Ámbar, no rojo: no hay veredicto de SUNAT y el documento todavía puede
    // emitirse cuando se resuelva la red.
    //
    // Se comprueba la clase de color EFECTIVA y no "no contiene destructive":
    // la base del componente lleva `aria-invalid:border-destructive` en su
    // cadena de clases, así que buscar esa palabra daría un falso negativo.
    const { container } = render(<InvoiceStatusBadge estado="SIN_CONFIRMAR" />);
    const clases = container.firstElementChild?.className ?? '';

    expect(clases).toContain('text-amber-700');
    expect(clases).not.toContain('text-destructive');
  });

  it('un rechazo real de SUNAT sigue diciendo "Rechazado"', () => {
    // La condición del pedido: el caso contrario no puede cambiar.
    render(<InvoiceStatusBadge estado="RECHAZADO" codigo="2992" />);

    expect(screen.getByText(/Rechazado/)).toBeDefined();
    expect(screen.getByText(/2992/)).toBeDefined();
  });

  it('describe el fallo de envío para lectores de pantalla', () => {
    const { container } = render(<InvoiceStatusBadge estado="SIN_CONFIRMAR" />);

    expect(container.firstElementChild?.getAttribute('aria-label')).toContain(
      'Incertidumbre de transporte',
    );
  });

  it('no añade el código 0, que es un aceptado sin interés', () => {
    const { container } = render(<InvoiceStatusBadge estado="ACEPTADO" codigo="0" />);

    expect(container.textContent).not.toContain('0');
  });
});
