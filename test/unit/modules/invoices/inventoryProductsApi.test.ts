import { describe, expect, it, vi } from 'vitest';
import { productosDesdeStocks, cargarProductosAlmacen, guardarPrecio } from '@/modules/invoices/services/inventoryProductsApi';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), patch: vi.fn() } }));
describe('precio de venta final, sin recambio por costo', () => {
  it.each([null, undefined, 0, -1, 'n/a'])('no ofrece precio ausente o inválido %s', salePrice => {
    expect(productosDesdeStocks({ balances: [{ sku: 'A', description: 'x', salePrice }] })).toEqual([]);
  });
  it.each(['10', '20', '30', '11'])('selección conserva el precio final y el tratamiento %s', codigo => {
    const p = productosDesdeStocks({ balances: [{ sku: 'A', description: 'x', sunatUnitCode: 'NIU', salePrice: '35.40', currentStock: '2', taxAffectation: codigo }] })[0];
    const item = itemDesdeProducto(p, '1');
    expect(item.precioUnitario).toBe(35.4);
    expect(item.valorUnitario).toBe(codigo === '10' ? 30 : 35.4);
    expect(p.stock).toBe(2);
  });
  it('respuesta vacía no inventa productos', () => {
    expect(productosDesdeStocks(null)).toEqual([]);
    expect(productosDesdeStocks(undefined)).toEqual([]);
    expect(productosDesdeStocks({})).toEqual([]);
  });
  it('consulta el almacén elegido y nunca recurre al costo si falla el catálogo', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('sin catálogo'));
    expect(await cargarProductosAlmacen('ALM-02')).toEqual([]);
    expect(apiClient.get).toHaveBeenLastCalledWith('/invoices/products', { params: { almacen: 'ALM-02' } });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
  it('edita solo sale_price por la interfaz existente', async () => {
    await guardarPrecio('CEM-001', 35.4);
    expect(apiClient.patch).toHaveBeenCalledWith('/inventory/stocks/products/CEM-001', { sale_price: 35.4 });
  });
});
