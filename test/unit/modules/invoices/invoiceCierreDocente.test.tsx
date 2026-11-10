import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { InventoryProductSearchSelect } from '@/modules/invoices/components/InventoryProductSearchSelect';
import { useInvoiceKeyboard } from '@/modules/invoices/components/useInvoiceKeyboard';
afterEach(cleanup);
it('6G alta conserva bloqueo previo y asocia errores/foco sin cambiar reglas ni enviar', async () => {
 render(<QueryClientProvider client={new QueryClient()}><PartnerFormDialog onClose={vi.fn()} initialRole="CLIENTE" /></QueryClientProvider>);
 const numero = screen.getByLabelText('Número'), nombre = screen.getByLabelText('Razón social');
 expect(numero.getAttribute('aria-invalid')).toBe('true'); expect(nombre.getAttribute('aria-describedby')).toBe('partner-nombre-error');
 expect((screen.getByRole('button', { name: 'Guardar tercero' }) as HTMLButtonElement).disabled).toBe(true);
 await waitFor(() => expect(document.activeElement).toBe(numero));
 fireEvent.change(numero, { target: { value: '12345678' } }); fireEvent.change(nombre, { target: { value: 'Cliente' } });
 expect((screen.getByRole('button', { name: 'Guardar tercero' }) as HTMLButtonElement).disabled).toBe(false);
});
it('6G producto se selecciona por flecha y Enter, no por solo escribir', () => {
 const elegir = vi.fn(); render(<InventoryProductSearchSelect productos={[{ sku: 'ARE', descripcion: 'Arena', unidad: 'MTQ', valorUnitario: 100, precioUnitario: 118 }]} onElegir={elegir} />);
 const input = screen.getByLabelText('Buscar producto'); fireEvent.change(input, { target: { value: 'ARE' } }); expect(elegir).not.toHaveBeenCalled(); fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' }); expect(elegir).toHaveBeenCalledTimes(1);
});
it('6G Ctrl+Enter revisa sin emitir y confirma una sola vez', () => {
 const add = vi.fn(), emitir = vi.fn(); function Form() { const k = useInvoiceKeyboard(add, emitir, false); return <div onKeyDown={k.handler}><input aria-label="Entrada" />{k.ayuda}</div>; }
 render(<Form />); const input = screen.getByLabelText('Entrada'); fireEvent.keyDown(input, { key: 'l', altKey: true }); expect(add).toHaveBeenCalledTimes(1);
 fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); expect(emitir).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar emisión revisada' })); expect(emitir).toHaveBeenCalledTimes(1);
});
