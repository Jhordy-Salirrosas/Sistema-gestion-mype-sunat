import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryProductSearchSelect } from '@/modules/invoices/components/InventoryProductSearchSelect';
import { productosDesdeStocks } from '@/modules/invoices/services/inventoryProductsApi';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
it('6E sugerencia y selección comparten el precio final sin repricing', () => {
 const productos = productosDesdeStocks({ balances: [{ sku: 'ARE-001', description: 'Arena', sunatUnitCode: 'MTQ', taxAffectation: '10', salePrice: 118 }] });
 const elegir = vi.fn(); render(<InventoryProductSearchSelect productos={productos} onElegir={elegir} />);
 fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'ARE' } });
 expect(screen.getByText(/118.00.*precio final/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: /ARE-001/ }));
 expect(itemDesdeProducto(elegir.mock.calls[0][0], '1')).toMatchObject({ precioUnitario: 118, valorUnitario: 100 });
});
