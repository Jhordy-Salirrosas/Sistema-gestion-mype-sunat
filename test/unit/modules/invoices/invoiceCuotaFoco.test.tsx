import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditInstallmentsEditor } from '@/modules/invoices/components/CreditInstallmentsEditor';
import type { CuotaBorrador } from '@/modules/invoices/lib/invoiceDetraccion';

afterEach(cleanup);
function Editor() {
  const [cuotas, setCuotas] = useState<readonly CuotaBorrador[]>([{ monto: 590, vencimiento: '2026-12-01' }]);
  return <CreditInstallmentsEditor cuotas={cuotas} netoPendiente={1180} fechaEmision="2026-11-01" onCambiar={setCuotas} />;
}
it('un clic y teclear reemplaza el importe anterior y actualiza la suma', async () => {
  const usuario = userEvent.setup();
  render(<Editor />);
  const campo = screen.getByLabelText('Importe de la cuota 1') as HTMLInputElement;
  await usuario.click(campo);
  await usuario.keyboard('100');
  fireEvent.blur(campo);
  expect(campo.value).toBe('100.00');
  expect(screen.getAllByText(/cuotas suman/i)[0].textContent).toContain('100.00');
});
it('pegar sustituye el monto seleccionado y conserva los centavos', async () => {
  const usuario = userEvent.setup();
  render(<Editor />);
  const campo = screen.getByLabelText('Importe de la cuota 1') as HTMLInputElement;
  await usuario.click(campo);
  await usuario.paste('100.50');
  fireEvent.blur(campo);
  expect(campo.value).toBe('100.50');
  expect(screen.getAllByText(/cuotas suman/i)[0].textContent).toContain('100.50');
});
