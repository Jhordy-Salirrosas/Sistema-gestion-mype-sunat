import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { ControlSaldoNotas } from '../../../src/modules/invoices/application/services/creditNoteBalanceGuard';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('8B-ter P3: devolución física y legado 02 en PostgreSQL local', () => {
 let db: PrismaService, company: string, origin: string;
 let atomic: AtomicInvoiceCreationService, coordinator: InvoiceBridgeCoordinatorService;
 const old = process.env.DATABASE_URL;
 const accounts = ['121210','401110','701210','691110','201110'];
 const createdAccounts: string[] = [];
 const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job-simulado') };
 const dto = (motivo: string, cantidad = 10, precioUnitario = 11.8) => ({
  tipo_comprobante: '07', serie: 'FC01', fecha_emision: '2026-11-11', forma_pago: 'Contado',
  customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente',
  documento_afectado: 'F001-00000069', codigo_motivo_nota: motivo,
  items: [{ codigo: 'MAT', descripcion: 'Producto', cantidad, precioUnitario }],
 });
 const issue = (motivo: string, cantidad = 10, precio = 11.8, key = randomUUID()) => atomic.emitir(dto(motivo, cantidad, precio) as never, company, key);
 beforeAll(async () => {
  if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Solo PostgreSQL local desechable');
  process.env.DATABASE_URL = url; db = new PrismaService(); await db.$connect();
  for (const code of accounts) {
   if (!await db.accountingAccount.findUnique({ where: { code } })) {
    await db.accountingAccount.create({ data: { code, name: 'Cuenta de prueba', element: code[0], nature: 'Deudora', level: 6 } }); createdAccounts.push(code);
   }
  }
 });
 beforeEach(async () => {
  company = randomUUID();
  await db.company.create({ data: { id: company, ruc: '2'+Date.now().toString().slice(-10), legal_name: 'Empresa prueba P3', sol_user: 'fake', sol_pass_encrypted: 'fake', ...fakeFiscalAddress } });
  const warehouse = await db.inventoryWarehouse.create({ data: { company_id: company, warehouse_code: 'ALM-01', description: 'Prueba' } });
  await db.inventoryProduct.create({ data: { company_id: company, sku: 'MAT', description: 'Producto', is_inventory: true, sale_price: 11.8, tax_affectation: '10', sunat_unit_code: 'NIU' } });
  origin = (await db.invoice.create({ data: { company_id: company, ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', correlativo: 69, monto_total: 118, fecha_emision: new Date('2026-11-10'), estado: 'ACEPTADO', customer_identity_type: '6', customer_identity_number: '20100070970', payload_ubl: { almacen: 'ALM-01' },
   items: { create: [{ item_order: 1, item_code: 'MAT', description: 'Producto', quantity: 10, unit_value: 10, unit_price: 11.8, igv_affectation_type: '10', igv_amount: 18, total_amount: 118 }] } } })).id;
  await db.invoiceSeries.create({ data: { company_id: company, document_type: '07', series: 'FC01' } });
  for (const [line_order, account_code] of [[1,accounts[0]],[2,accounts[1]],[3,accounts[2]],[10,accounts[3]],[11,accounts[4]]] as const) await db.accountingRule.create({ data: { company_id: company, process_code: 'VENTA', line_order, account_code, side: 'D', base_calculation: 'TOTAL' } });
  const manual = new RegisterManualMovementUseCase(undefined as never, undefined as never, undefined as never, undefined as never, undefined, db);
  await manual.execute({ warehouse_code: warehouse.warehouse_code, sku: 'MAT', direction: 'ENTRADA', quantity: 10, unit_cost: 30, operation_type_code: '02' }, company);
  await manual.execute({ warehouse_code: warehouse.warehouse_code, sku: 'MAT', direction: 'SALIDA', quantity: 10, operation_type_code: '01', source_reference_id: 'F001-00000069' }, company);
  const bridge = new InvoiceAccountingBridgeService(db, manual, new GenerateAccountingEntryUseCase(new PrismaAccountingRepository(db)));
  coordinator = new InvoiceBridgeCoordinatorService(db, bridge);
  atomic = new AtomicInvoiceCreationService(db, queue as never);
 });
 afterEach(async () => {
  await db.accountingLine.deleteMany({ where: { entry: { company_id: company } } });
  await db.accountingEntry.deleteMany({ where: { company_id: company } });
  await db.accountingPeriod.deleteMany({ where: { company_id: company } });
  await db.accountingFiscalYear.deleteMany({ where: { company_id: company } });
  await db.inventoryCostLayer.deleteMany({ where: { company_id: company } });
  await db.inventoryMovement.deleteMany({ where: { company_id: company } });
  await db.inventoryBalance.deleteMany({ where: { company_id: company } });
  await db.inventoryProduct.deleteMany({ where: { company_id: company } });
  await db.inventoryWarehouse.deleteMany({ where: { company_id: company } });
  await db.invoiceCreationRequest.deleteMany({ where: { company_id: company } });
  await db.invoice.deleteMany({ where: { company_id: company, referenced_invoice_id: { not: null } } });
  await db.invoice.deleteMany({ where: { company_id: company } });
  await db.invoiceSeries.deleteMany({ where: { company_id: company } });
  await db.company.delete({ where: { id: company } });
 });
 afterAll(async () => {
  if (db) { await db.accountingAccount.deleteMany({ where: { code: { in: createdAccounts } } }); await db.$disconnect(); }
  if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
 });
 it.each([['01','PROMEDIO'],['02','PROMEDIO'],['02','FIFO'],['06','PROMEDIO'],['07','PROMEDIO']] as const)('NC nueva %s aceptada (%s): entrada, capa histórica, reverso de venta/costo e idempotencia', async (motivo, metodo) => {
  await db.company.update({ where: { id: company }, data: { inventory_cost_method: metodo } });
  const note = await issue(motivo);
  const stored = await db.invoice.findUniqueOrThrow({ where: { id: note.id } });
  if (motivo === '02') expect((stored.payload_ubl as any).politicaDevolucionFisica02).toBe(1);
  await db.invoice.update({ where: { id: note.id }, data: { estado: 'ACEPTADO' } });
  const result = await coordinator.reprocesar(company, note.id);
  expect(result).toMatchObject({ completo: true, movimientosRegistrados: 1, costoVenta: -300 });
  const movement = await db.inventoryMovement.findFirstOrThrow({ where: { company_id: company, source_reference_id: note.numero, operation_type_code: '05' } });
  expect(movement.direction).toBe('ENTRADA'); expect(Number(movement.quantity)).toBe(10);
  expect(Number(movement.unit_cost)).toBe(30); expect(Number(movement.total_cost)).toBe(300);
  const layer = await db.inventoryCostLayer.findFirstOrThrow({ where: { source_movement_id: movement.id } });
  expect(Number(layer.quantity_remaining)).toBe(10); expect(Number(layer.unit_cost)).toBe(30);
  const entries = await db.accountingEntry.findMany({ where: { company_id: company }, include: { lines: true } });
  expect(entries).toHaveLength(2);
  const amounts = entries.flatMap(e => e.lines.map(l => [l.account_code, Number(l.debit_amount), Number(l.credit_amount)]));
  expect(amounts).toEqual(expect.arrayContaining([[accounts[0],0,118],[accounts[1],18,0],[accounts[2],100,0],[accounts[4],300,0],[accounts[3],0,300]]));
  await coordinator.registrarComoTrabajo(note.id, 'ACEPTADO');
  expect(await db.inventoryMovement.count({ where: { company_id: company, operation_type_code: '05' } })).toBe(1);
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(2);
  expect(await db.inventoryCostLayer.count({ where: { source_movement_id: movement.id } })).toBe(1);
 });
 it('nota 02 histórica: lectura del pool sí, movimientos y asientos retroactivos no', async () => {
  const historical = await db.invoice.create({ data: { company_id: company, ruc_emisor: '20100070970', tipo_comprobante: '07', serie: 'FC00', correlativo: 1, estado: 'ACEPTADO', referenced_invoice_id: origin, credit_debit_reason_code: '02', monto_total: 23.6, fecha_emision: new Date('2026-11-10'), payload_ubl: {},
   items: { create: [{ item_order: 1, item_code: 'MAT', description: 'Producto', quantity: 2, unit_value: 10, unit_price: 11.8, igv_affectation_type: '10', igv_amount: 3.6, total_amount: 23.6 }] } } });
  expect((await new ControlSaldoNotas(db).calcular(company, origin)).cantidades_pendientes).toEqual([{ codigo: 'MAT', original: 10, pendiente: 8 }]);
  await expect(issue('02', 10, 9.44)).rejects.toThrow('NOTA_EXCEDE_CANTIDAD');
  const next = await issue('02', 8, 11.8);
  expect(next.monto_total).toBe(94.4);
  for (let i=0; i<2; i++) expect(await coordinator.reprocesar(company, historical.id)).toMatchObject({ completo: true, motivoOmision: 'M1_LEGACY_02_NO_RETROACTIVITY' });
  await coordinator.registrarComoTrabajo(historical.id, 'ACEPTADO');
  expect(await db.inventoryMovement.count({ where: { company_id: company, operation_type_code: '05' } })).toBe(0);
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(0);
  expect(await db.transactionHistory.count({ where: { invoice_id: historical.id, codigo_error: 'M1_LEGACY_02_NO_RETROACTIVITY' } })).toBe(1);
  expect((await db.invoice.findUniqueOrThrow({ where: { id: historical.id } })).payload_ubl).toEqual({});
  await db.invoice.update({ where: { id: next.id }, data: { estado: 'ACEPTADO' } });
  expect(await coordinator.reprocesar(company, next.id)).toMatchObject({ completo: true, costoVenta: -240 });
  const nextMovement = await db.inventoryMovement.findFirstOrThrow({ where: { company_id: company, operation_type_code: '05', source_reference_id: next.numero } });
  expect(Number(nextMovement.quantity)).toBe(8); expect(Number(nextMovement.total_cost)).toBe(240);
  expect(await db.inventoryMovement.count({ where: { company_id: company, source_reference_id: 'FC00-00000001' } })).toBe(0);
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(2);

 });
});
