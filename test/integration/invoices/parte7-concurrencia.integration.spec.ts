import { PrismaInvoiceRepository } from '../../../src/modules/invoices/infrastructure/persistence/prismaInvoiceRepository';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { InventoryCostLayerService } from '../../../src/modules/inventory/application/services/inventoryCostLayerService';
import { InventoryTransferService } from '../../../src/modules/inventory/application/services/inventoryTransferService';
import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { validarReservaVenta } from '../../../src/modules/invoices/application/services/invoiceStockReservation';
import { prepareCreation } from '../../../src/modules/invoices/application/services/creationGuards';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Parte 7: exclusión real en PostgreSQL, sin cola ni SUNAT', () => {
 let db: PrismaService, company: string, warehouse: string, product: string;
 const old = process.env.DATABASE_URL;
 const dto = { tipo_comprobante: '01', serie: 'F001', almacen: 'ALM-02', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente', items: [{ codigo: 'CEM', descripcion: 'Cemento', cantidad: 1, precioUnitario: 118 }] };
 const data = (n: number) => ({ company_id: company, ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', correlativo: n, monto_total: 118, fecha_emision: new Date(), payload_ubl: { almacen: 'ALM-02' }, customer_identity_type: '6', customer_identity_number: '20100070970',
 items: { create: [{ item_order: 1, item_code: 'CEM', description: 'Cemento', quantity: 1, unit_value: 100, unit_price: 118, igv_affectation_type: '10', igv_amount: 18, total_amount: 118 }] } });
 beforeAll(async () => {
  if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Solo PostgreSQL local aislado');
  process.env.DATABASE_URL = url; db = new PrismaService(); await db.$connect(); company = randomUUID();
  await db.company.create({ data: { id: company, ruc: '2'+Date.now().toString().slice(-10), legal_name: 'Parte7 ficticia', sol_user: 'fake', sol_pass_encrypted: 'fake' } });
  warehouse = (await db.inventoryWarehouse.create({ data: { company_id: company, warehouse_code: 'ALM-02', description: 'Local ficticio' } })).id;
  product = (await db.inventoryProduct.create({ data: { company_id: company, sku: 'CEM', description: 'Cemento', sale_price: 118, tax_affectation: '10' } })).id;
  await db.inventoryBalance.create({ data: { company_id: company, warehouse_id: warehouse, product_id: product, current_stock: 1, average_unit_cost: 10, total_inventory_value: 10 } });
 });
 const limpiarStock = async () => {
  await db.inventoryTransferItem.deleteMany({ where: { transfer: { company_id: company } } });
  await db.inventoryTransfer.deleteMany({ where: { company_id: company } });
  await db.inventoryAdjustmentItem.deleteMany({ where: { adjustment: { company_id: company } } });
  await db.inventoryAdjustment.deleteMany({ where: { company_id: company } });
  await db.inventoryCostLayer.deleteMany({ where: { company_id: company } });
  await db.inventoryMovement.deleteMany({ where: { company_id: company } });
 };
 const manual = () => new RegisterManualMovementUseCase(undefined as never, undefined as never, undefined as never, undefined as never, undefined, db);
 const saldo = async (q = 1, cost = 10) => db.inventoryBalance.updateMany({ where: { company_id: company, warehouse_id: warehouse }, data: { current_stock: q, average_unit_cost: cost, total_inventory_value: q * cost } });
 const capa = (q = 1, cost = 10) => db.inventoryCostLayer.create({ data: { company_id: company, warehouse_id: warehouse, product_id: product, quantity_remaining: q, unit_cost: cost } });
 beforeEach(async () => {
  await limpiarStock(); await saldo(); await db.company.update({ where: { id: company }, data: { inventory_cost_method: 'PROMEDIO' } });
  await db.invoice.deleteMany({ where: { company_id: company, referenced_invoice_id: { not: null } } });
  await db.invoice.deleteMany({ where: { company_id: company } });
 });
 afterAll(async () => {
  if (db) { await limpiarStock(); await db.invoice.deleteMany({ where: { company_id: company, referenced_invoice_id: { not: null } } }); await db.invoice.deleteMany({ where: { company_id: company } });
   await db.inventoryBalance.deleteMany({ where: { company_id: company } }); await db.inventoryProduct.deleteMany({ where: { company_id: company } }); await db.inventoryWarehouse.deleteMany({ where: { company_id: company } }); await db.company.delete({ where: { id: company } }); await db.$disconnect(); }
  if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
 });
 it('7E stock uno: dos ventas concurrentes, solo una reserva confirmada', async () => {
  const results = await Promise.allSettled([1,2].map(n => db.$transaction(async tx => { await validarReservaVenta(tx, dto as never, company); return tx.invoice.create({ data: data(n) }); })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  expect(await db.invoice.count({ where: { company_id: company } })).toBe(1);
 });
 it('7D dos NC simultáneas no devuelven dos veces la unidad del origen OBSERVADO', async () => {
  const origin = await db.invoice.create({ data: { ...data(1), estado: 'OBSERVADO' } });
  const results = await Promise.allSettled([1,2].map(n => db.$transaction(async tx => {
   await prepareCreation(tx, { ...dto, tipo_comprobante: '07', serie: 'FC01', referenced_invoice_id: origin.id, codigo_motivo_nota: '01' } as never, company);
   return tx.invoice.create({ data: { ...data(n), tipo_comprobante: '07', serie: 'FC01', referenced_invoice_id: origin.id, credit_debit_reason_code: '01' } });
  })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
 });
 it('7H dos reprocesos del mismo comprobante no intercalan el puente', async () => {
  const invoice = await db.invoice.create({ data: { ...data(1), estado: 'ACEPTADO' } });
  let active = 0, max = 0;
  const bridge = { registrar: async () => {
   active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 30)); active--;
   return { completo: true, asientoId: 'asiento', asientoOmitido: true, movimientosRegistrados: 0, movimientosOmitidos: 1, errores: [] };
  } };
  const coordinator = new InvoiceBridgeCoordinatorService(db, bridge as never);
  await Promise.all([coordinator.reprocesar(company, invoice.id), coordinator.reprocesar(company, invoice.id)]);
  expect(max).toBe(1);
 });

 it('7K entrada PROMEDIO crea capa al costo recibido sin cambiar saldo/promedio', async () => {
  await capa();
  const result = await manual().execute({ warehouse_code: 'ALM-02', sku: 'CEM', direction: 'ENTRADA', quantity: 3, unit_cost: 20, operation_type_code: '02' }, company);
  expect(result).toMatchObject({ resultingStock: 4, resultingAverageCost: 17.5, totalCost: 60 });
  expect(await db.inventoryCostLayer.findFirst({ where: { source_movement_id: result.movementId } })).toMatchObject({ quantity_remaining: expect.anything(), unit_cost: expect.anything() });
  const layers = await db.inventoryCostLayer.findMany({ where: { company_id: company } });
  expect(layers.map(l => [Number(l.quantity_remaining), Number(l.unit_cost)])).toEqual(expect.arrayContaining([[1,10],[3,20]]));
 });
 it('7K fallo al crear capa revierte movimiento y saldo en la misma transacción', async () => {
  await capa(); const spy = jest.spyOn(InventoryCostLayerService.prototype, 'registrarEntrada').mockRejectedValueOnce(new Error('fallo capa simulado'));
  try { await expect(manual().execute({ warehouse_code: 'ALM-02', sku: 'CEM', direction: 'ENTRADA', quantity: 3, unit_cost: 20, operation_type_code: '02' }, company)).rejects.toThrow('fallo capa'); }
  finally { spy.mockRestore(); }
  expect(await db.inventoryMovement.count({ where: { company_id: company } })).toBe(0);
  expect(Number((await db.inventoryBalance.findFirstOrThrow({ where: { company_id: company } })).current_stock)).toBe(1);
 });
 it.each(['FIFO','PROMEDIO'] as const)('7K salida %s consume capas una vez conservando su método', async metodo => {
  await saldo(2,20); await capa(1,10); await capa(1,30); await db.company.update({ where: { id: company }, data: { inventory_cost_method: metodo } });
  const result = await manual().execute({ warehouse_code: 'ALM-02', sku: 'CEM', direction: 'SALIDA', quantity: 1, operation_type_code: '01' }, company);
  expect(result.totalCost).toBe(metodo === 'FIFO' ? 10 : 20); expect(result.resultingStock).toBe(1);
  const layers = await db.inventoryCostLayer.findMany({ where: { company_id: company } });
  expect(layers.reduce((sum,l) => sum + Number(l.quantity_remaining),0)).toBe(1);
 });
 it.each(['FIFO','PROMEDIO'] as const)('7K traslado %s preserva costo y cantidades del método declarado', async metodo => {
  await saldo(2,20); await capa(1,10); await capa(1,30); await db.company.update({ where: { id: company }, data: { inventory_cost_method: metodo } });
  const to = await db.inventoryWarehouse.upsert({ where: { company_id_warehouse_code: { company_id: company, warehouse_code: 'ALM-03' } }, update: {}, create: { company_id: company, warehouse_code: 'ALM-03', description: 'Destino' } });
  await db.inventoryBalance.deleteMany({ where: { warehouse_id: to.id } });
  await new InventoryTransferService(db).createTransfer(company, { fromWarehouseCode: 'ALM-02', toWarehouseCode: 'ALM-03', transferNumber: 'PARTE7', items: [{ sku: 'CEM', quantity: 1 }] });
  const dest = await db.inventoryBalance.findFirstOrThrow({ where: { warehouse_id: to.id } });
  const destLayers = await db.inventoryCostLayer.findMany({ where: { warehouse_id: to.id } });
  expect(Number(dest.current_stock)).toBe(1); expect(Number(dest.average_unit_cost)).toBe(metodo === 'FIFO' ? 10 : 20);
  expect(destLayers.map(l => [Number(l.quantity_remaining),Number(l.unit_cost)])).toEqual([[1, metodo === 'FIFO' ? 10 : 20]]);
 });
 it('7K capa insuficiente no confirma movimiento ni saldo; costo desconocido tampoco inventa cero', async () => {
  await expect(manual().execute({ warehouse_code: 'ALM-02', sku: 'CEM', direction: 'SALIDA', quantity: 1, operation_type_code: '01' }, company)).rejects.toThrow('Capas de costo insuficientes');
  await saldo(0,0);
  await expect(manual().execute({ warehouse_code: 'ALM-02', sku: 'CEM', direction: 'ENTRADA', quantity: 1, operation_type_code: '02' }, company)).rejects.toThrow('sin costo acreditado');
  expect(await db.inventoryMovement.count({ where: { company_id: company } })).toBe(0);
 });
 it('7K ajuste positivo usa promedio acreditado y el negativo mantiene capas simétricas', async () => {
  await capa(); const service = new InventoryTransferService(db);
  await service.createAdjustment(company, { warehouseCode: 'ALM-02', type: 'ENTRADA', reason: 'Prueba', adjustmentNumber: 'E', items: [{ sku: 'CEM', quantity: 1 }] });
  await service.createAdjustment(company, { warehouseCode: 'ALM-02', type: 'SALIDA', reason: 'Prueba', adjustmentNumber: 'S', items: [{ sku: 'CEM', quantity: 1 }] });
  const layers = await db.inventoryCostLayer.findMany({ where: { company_id: company } });
  expect(layers.reduce((sum,l) => sum + Number(l.quantity_remaining),0)).toBe(1);
  expect(Number((await db.inventoryBalance.findFirstOrThrow({ where: { warehouse_id: warehouse } })).average_unit_cost)).toBe(10);
 });

 it('7M cola null revierte la factura insertada en PostgreSQL', async () => {
  const queue = { enqueueInvoiceInTx: jest.fn(async () => null) };
  const repo = new PrismaInvoiceRepository(db, queue as never);
  await expect(repo.saveWithTransactionalOutbox({ ...data(7), estado: 'PENDIENTE' } as never)).rejects.toMatchObject({ response: { code: 'OUTBOX_WRITE_FAILED' } });
  expect(queue.enqueueInvoiceInTx).toHaveBeenCalledTimes(1);
  expect(await db.invoice.count({ where: { company_id: company } })).toBe(0);
 });

});
