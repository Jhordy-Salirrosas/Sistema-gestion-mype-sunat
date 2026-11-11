import { validarReservaVenta } from '../../../src/modules/invoices/application/services/invoiceStockReservation';
function h() {
 const tx = { inventoryProduct: { findMany: jest.fn(async () => [{ id: 'p', sku: 'CEM', is_inventory: true }]) },
 inventoryWarehouse: { findFirstOrThrow: jest.fn(async () => ({ id: 'wh' })) }, $executeRaw: jest.fn(),
 inventoryBalance: { findMany: jest.fn(async () => [{ product_id: 'p', current_stock: 1 }]) },
 invoice: { findMany: jest.fn(async () => [{ payload_ubl: { almacen: 'ALM-02' }, serie: 'F001', correlativo: 1, items: [{ item_code: 'CEM', quantity: 1 }] }]) },
 inventoryMovement: { findMany: jest.fn(async () => [] as any[]) } };
 const dto = { tipo_comprobante: '01', almacen: 'ALM-02', items: [{ codigo: 'CEM', cantidad: 1 }] };
 return { tx, dto, run: () => validarReservaVenta(tx as never, dto as never, 'company') };
}
it('7E una venta persistida sin descarga reserva la última unidad aunque siga en cola', async () => {
 const t = h(); await expect(t.run()).rejects.toThrow('STOCK_COMPROMETIDO');
 expect(t.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(t.tx.invoice.findMany.mock.invocationCallOrder[0]);
});
it('7E una descarga confirmada no resta su reserva dos veces', async () => {
 const t = h(); t.tx.inventoryMovement.findMany.mockResolvedValue([{ product_id: 'p', source_reference_id: 'F001-00000001', quantity: 1 }]);
 await expect(t.run()).resolves.toBeUndefined();
});
it('7E valida SKU repetido contra disponible, no por línea', async () => {
 const t = h(); t.tx.invoice.findMany.mockResolvedValue([]); t.dto.items = [{ codigo: 'CEM', cantidad: .6 }, { codigo: 'CEM', cantidad: .6 }];
 await expect(t.run()).rejects.toThrow('STOCK_COMPROMETIDO');
});
it('7E las notas no reservan salida física', async () => {
 const t = h(); t.dto.tipo_comprobante = '08'; await t.run(); expect(t.tx.$executeRaw).not.toHaveBeenCalled();
});
