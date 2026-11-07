import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreditInstallmentsEditor } from '@/modules/invoices/components/CreditInstallmentsEditor';
import type { CuotaBorrador } from '@/modules/invoices/lib/invoiceDetraccion';
afterEach(cleanup);
function Editor() {
  const [cuotas, setCuotas] = useState<readonly CuotaBorrador[]>([{ monto: 590, vencimiento: '2026-12-01' }, { monto: 590, vencimiento: '2027-01-01' }]);
  return <CreditInstallmentsEditor cuotas={cuotas} netoPendiente={1180} fechaEmision="2026-11-01" onCambiar={setCuotas} />;
}
it('permite teclear importes desiguales sin reformatear cada tecla', () => {
  render(<Editor />);
  const campo = screen.getByLabelText('Importe de la cuota 1') as HTMLInputElement;
  expect(screen.getByText(/cronograma cuadra al céntimo/i)).toBeTruthy();
  fireEvent.focus(campo);
  for (const valor of ['', '1', '10', '100', '1000']) fireEvent.change(campo, { target: { value: valor } });
  expect(campo.value).toBe('1000');
  fireEvent.blur(campo);
  expect(campo.value).toBe('1000.00');
  expect(screen.getAllByText(/cuotas suman/)[0].textContent).toContain('1590.00');
  expect(screen.getByText(/faltan -410.00/i)).toBeTruthy();
  expect(screen.queryByText(/cronograma cuadra al céntimo/i)).toBeNull();
});
