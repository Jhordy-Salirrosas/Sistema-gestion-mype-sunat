import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { InvoiceDescuentoGlobal } from '@/modules/invoices/components/InvoiceDescuentoGlobal';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import type { DescuentoGlobal } from '@/modules/invoices/lib/invoiceDescuentoGlobal';
afterEach(cleanup);
function Harness({ global }: { global: boolean }) {
 const [items, setItems] = useState([{ ...itemVacio('1'), descripcion: 'Cemento', valorUnitario: 35, descuento: { codigo: '00' as const, monto: 0 } }]);
 const [descuento, setDescuento] = useState<DescuentoGlobal | null>({ codigo: '02', monto: 0 });
 return <><output aria-label="Monto persistido">{global ? descuento?.monto : items[0].descuento.monto}</output>{global
 ? <InvoiceDescuentoGlobal valor={descuento} onChange={setDescuento} />
 : <InvoiceItemsGrid items={items} onCambiar={(i, cambio) => setItems(prev => prev.map((item, n) => n === i ? { ...item, ...cambio } as typeof item : item))} onEliminar={() => {}} onAgregar={() => {}} onAgregarBolsa={() => {}} />}</>;
}
describe.each([false, true])('borrador textual de descuento, global=%s', global => {
 const label = global ? 'Monto del descuento global' : 'Monto de descuento de la línea 1';
 it('escribe 4.13 secuencialmente y mantiene los dígitos antes del punto', async () => {
  const user = userEvent.setup(); render(<Harness global={global} />); const input = screen.getByLabelText(label);
  await user.clear(input); await user.type(input, '4.'); expect(input).toHaveValue('4.');
  await user.type(input, '13'); expect(input).toHaveValue('4.13'); expect(screen.getByLabelText('Monto persistido')).toHaveTextContent('4.13');
  await user.tab(); expect(input).toHaveValue('4.13');
 });
 it('pega, borra, reescribe y formatea al abandonar sin alterar el monto', async () => {
  const user = userEvent.setup(); render(<Harness global={global} />); const input = screen.getByLabelText(label);
  await user.clear(input); await user.paste('4.13'); expect(input).toHaveValue('4.13');
  await user.clear(input); expect(input).toHaveValue(''); expect(screen.getByLabelText('Monto persistido')).toHaveTextContent('0');
  await user.type(input, '7.1'); await user.tab(); expect(input).toHaveValue('7.10'); expect(screen.getByLabelText('Monto persistido')).toHaveTextContent('7.1');
 });
});
