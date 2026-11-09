import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';
function service(stock: number, inventory = true) {
  return new StockValidationService({ inventoryProduct: { findMany: async () => [{ id: 'p', sku: 'P', description: 'Producto', sunat_unit_code: 'NIU', tax_affectation: '10', is_inventory: inventory }] },
    inventoryBalance: { groupBy: async () => [{ product_id: 'p', _sum: { current_stock: stock } }] } } as never);
}
const item = (cantidad: number) => ({ codigo: ' P ', descripcion: 'Producto', cantidad, afectacion: '10' });
it('bloquea cantidades de SKU repetido que individualmente caben pero sumadas exceden stock', async () => {
  await expect(service(10).validar('empresa', [item(6), item(6)])).rejects.toThrow('se pide 12');
});
it('acepta suma exacta incluso con cantidades decimales', async () => {
  expect(await service(0.3).validar('empresa', [item(0.1), item(0.2)])).toMatchObject({ validados: 2 });
});
it('no impone stock a servicios repetidos', async () => {
  expect(await service(0, false).validar('empresa', [item(6), item(6)])).toMatchObject({ validados: 2 });
});
it('mantiene cotejo fiscal de cada línea repetida', async () => {
  await expect(service(10).validar('empresa', [item(1), { ...item(1), afectacion: '20' }])).rejects.toThrow('no coincide');
});
