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
 beforeEach(async () => {
  await db.invoice.deleteMany({ where: { company_id: company, referenced_invoice_id: { not: null } } });
  await db.invoice.deleteMany({ where: { company_id: company } });
 });
 afterAll(async () => {
  if (db) { await db.invoice.deleteMany({ where: { company_id: company, referenced_invoice_id: { not: null } } }); await db.invoice.deleteMany({ where: { company_id: company } });
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

});
