import { expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CreditInstallmentsEditor } from '@/modules/invoices/components/CreditInstallmentsEditor';

it('muestra el número de cuotas y el neto pendiente del crédito', () => {
  render(<CreditInstallmentsEditor cuotas={[{ monto: 50, vencimiento: '2026-12-01' }, { monto: 50, vencimiento: '2027-01-01' }]} netoPendiente={100} fechaEmision="2026-11-06" onCambiar={vi.fn()} />);
  expect(screen.getByText(/Pago a crédito en 2 cuotas.*100\.00/i)).toBeTruthy();
  cleanup();
});
