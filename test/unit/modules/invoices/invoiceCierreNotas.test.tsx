import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceMoneyInput } from '@/modules/invoices/components/InvoiceMoneyInput';
import { productosDesdeStocks } from '@/modules/invoices/services/inventoryProductsApi';
import { revisarGrilla } from '@/modules/invoices/lib/invoiceStockLinea';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
it('6A presenta dos decimales y no redondea precio heredado al enfocar', () => {
 const change = vi.fn(); render(<InvoiceMoneyInput aria-label="Precio" value={118.123456} onValue={change} />);
 const input = screen.getByLabelText('Precio') as HTMLInputElement;
 expect(input.value).toBe('118.12'); fireEvent.focus(input); fireEvent.blur(input);
 expect(change).not.toHaveBeenCalled();
});
it('6A notas usan existencia histórica sin convertirla en precio vendible', () => {
 const raw = { balances: [{ sku: 'HIST', description: 'Histórico', salePrice: null, vendible: false, sunatUnitCode: 'NIU', currentStock: 0 }] };
 expect(productosDesdeStocks(raw)).toEqual([]);
 const hist = productosDesdeStocks(raw, true);
 const item = itemDesdeProducto({ sku: 'HIST', descripcion: 'Origen', unidad: 'NIU', precioUnitario: 118, valorUnitario: 100, afectacion: '10' }, '1');
 expect(revisarGrilla([item], hist, { nota: true }).bloquea).toBe(false);
 expect(revisarGrilla([item], [], { estado: 'error' }).lineas[0].mensaje).not.toContain('no está en el inventario');
 expect(revisarGrilla([item], [], { estado: 'cargando' }).lineas[0].mensaje).toContain('Consultando');
 expect(item.precioUnitario).toBe(118);
});
