import { withBridgeTransaction } from '../../fixtures/bridgeTransactionPrisma';
import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { InvoiceStatus } from '../../../src/generated/client/enums';

it('no usa stock de otros almacenes y suma el SKU repetido solo en el elegido', async () => {
  const groupBy = jest.fn(async ({ where }) => [{ product_id: 'p', _sum: { current_stock: where.warehouse.warehouse_code === 'ALM-02' ? 2 : 300 } }]);
  const stock = new StockValidationService({ inventoryBalance: { groupBy }, inventoryProduct: { findMany: async () => [{ id: 'p', sku: 'CEM', is_inventory: true, description: 'Cemento' }] } } as never);
  const lineas = [1, 2].map(cantidad => ({ codigo: 'CEM', descripcion: 'Cemento', cantidad }));
  await expect(stock.validar('empresa', lineas, 'ALM-02')).rejects.toThrow('hay 2');
  await expect(stock.validar('empresa', lineas, 'ALM-01')).resolves.toMatchObject({ validados: 2 });
});
it('el consumidor entrega al puente el almacén persistido, sin resolver otro', async () => {
  const registrar = jest.fn(async () => ({ asientoId: 'asiento', completo: true, movimientosRegistrados: 1, movimientosOmitidos: 0, asientoOmitido: false, errores: [] }));
  const fila = { id: 'inv', company_id: 'empresa', tipo_comprobante: '01', serie: 'F001', correlativo: 1,
    fecha_emision: new Date('2026-11-10'), payload_ubl: { almacen: 'ALM-02', montoTotal: 118 }, items: [{ item_code: 'CEM', quantity: 1, unit_value: 100, igv_affectation_type: '10' }] };
  const consumer = new InvoiceJobConsumer({} as never, {} as never, withBridgeTransaction({ invoice: { findUnique: async () => fila } }) as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, { registrar } as never, {} as never, {} as never);
  await (consumer as any).registrarEnContabilidad('inv', InvoiceStatus.ACEPTADO);
  expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ almacen: 'ALM-02', companyId: 'empresa' }));
});

it('el catálogo marca precios ausentes sin exponer costo como precio y filtra el stock elegido', async () => {
  const { InvoiceQueryService } = await import('../../../src/modules/invoices/application/services/invoiceQueryService');
  const findMany = jest.fn(async () => [{ product_id: 'p', current_stock: 2, average_unit_cost: 15 }]);
  const warehouses = jest.fn(async () => [{ warehouse_code: 'ALM-01', description: 'Principal' }]);
  const query = new InvoiceQueryService({ inventoryBalance: { findMany }, inventoryWarehouse: { findMany: warehouses },
    inventoryProduct: { findMany: async () => [null, 0, -1, 35.4].map((sale_price, i) => ({ id: 'p', sku: `P${i}`, description: 'Producto', sunat_unit_code: 'NIU', tax_affectation: '10', sale_price })) } } as never, {} as never);
  const { balances } = await query.catalogoProductos('empresa', 'ALM-02');
  expect(balances.slice(0, 3)).toEqual(expect.arrayContaining([expect.objectContaining({ salePrice: null, vendible: false, motivo: 'sin precio de venta configurado' })]));
  expect(balances[3]).toMatchObject({ salePrice: 35.4, vendible: true, currentStock: 2 });
  expect(balances[3]).not.toHaveProperty('averageUnitCost');
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa', warehouse: { warehouse_code: 'ALM-02' } } }));
  await query.almacenes('empresa');
  expect(warehouses).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa', is_active: true } }));
});

it('6A catálogo histórico usa misma fuente por empresa sin habilitar venta de inactivos', async () => {
 const { InvoiceQueryService } = await import('../../../src/modules/invoices/application/services/invoiceQueryService');
 const productos = jest.fn(async () => [{ id: 'p', sku: 'HIST', description: 'Histórico', is_active: false, sale_price: null, sunat_unit_code: 'NIU' }]);
 const service = new InvoiceQueryService({ inventoryProduct: { findMany: productos }, inventoryBalance: { findMany: async () => [{ product_id: 'p', current_stock: 1 }] } } as never, {} as never);
 expect((await service.catalogoProductos('empresa', 'ALM-02', true)).balances[0]).toMatchObject({ sku: 'HIST', vendible: false, currentStock: 1 });
 expect(productos).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa' } }));
});

it.each([{ sunat_unit_code: null }, { sunat_unit_code: 'INVALIDA' }, { tax_affectation: null }, { tax_affectation: '99' }])('7N precio positivo sin configuración fiscal válida no se ofrece: %j', async changes => {
 const { InvoiceQueryService } = await import('../../../src/modules/invoices/application/services/invoiceQueryService');
 const product = { id: 'p', sku: 'ARE', description: 'Arena', sale_price: 118, sunat_unit_code: 'MTQ', tax_affectation: '10', ...changes };
 const service = new InvoiceQueryService({ inventoryProduct: { findMany: async () => [product] }, inventoryBalance: { findMany: async () => [] } } as never, {} as never);
 expect((await service.catalogoProductos('empresa')).balances[0]).toMatchObject({ vendible: false, salePrice: null, motivo: expect.stringMatching(/unidad|afectación/) });
});
it('7N MTQ con precio y afectación válidos sigue vendible', async () => {
 const { InvoiceQueryService } = await import('../../../src/modules/invoices/application/services/invoiceQueryService');
 const service = new InvoiceQueryService({ inventoryProduct: { findMany: async () => [{ id: 'p', sku: 'ARE', description: 'Arena', sale_price: 118, sunat_unit_code: 'MTQ', tax_affectation: '10' }] }, inventoryBalance: { findMany: async () => [] } } as never, {} as never);
 expect((await service.catalogoProductos('empresa')).balances[0]).toMatchObject({ vendible: true, salePrice: 118, motivo: null });
});
