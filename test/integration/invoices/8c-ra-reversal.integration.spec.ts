import { RaBridgeReversalService, raWorks } from '../../../src/modules/invoices/application/services/raBridgeReversalService';
import { SummaryAggregateStore } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
import { SummaryEnvioService } from '../../../src/modules/invoices/application/services/summaryEnvioService';
import { presentarResultado } from '../../../src/modules/invoices/application/services/invoiceResultPresentation';
import { aggregateHarness } from '../../fixtures/summaryAggregateHarness';
import { hashSummary } from '../../../src/modules/invoices/application/services/summaryGate';
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
(url ? describe : describe.skip)('8C C4: reversión RA durable y transaccional', () => {
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
  await db.invoiceAggregate.deleteMany({ where: { company_id: company } });
  await db.company.delete({ where: { id: company } });
 });
 afterAll(async () => {
  if (db) { await db.accountingAccount.deleteMany({ where: { code: { in: createdAccounts } } }); await db.$disconnect(); }
  if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
 });

 const manual = () => new RegisterManualMovementUseCase(undefined as never, undefined as never, undefined as never, undefined as never, undefined, db);
 const prepare = async () => {
  await coordinator.reprocesar(company, origin);
  const h = aggregateHarness();
  const xml = h.row.xml.replace('<sac:DocumentNumberID>1</sac:DocumentNumberID>', '<sac:DocumentNumberID>69</sac:DocumentNumberID>');
  const row = await db.invoiceAggregate.create({ data: { ...h.row, id: randomUUID(), company_id: company, xml, xml_hash: hashSummary(xml), members: [{ ...h.member, id: origin, correlativo: 69 }] } });
  return { row, cdr: h.cdr(), store: new SummaryAggregateStore(db, queue as never), service: new RaBridgeReversalService(db, manual()) };
 };
 it('aceptación conserva CDR y trabajo; revierte movimientos, capas y asientos una sola vez', async () => {
  const h = await prepare();
  await h.store.finalizar(h.row, h.cdr, '0');
  const accepted = await db.invoiceAggregate.findUniqueOrThrow({ where: { id: h.row.id } });
  expect(raWorks(accepted.result)).toMatchObject([{ action: 'REVERSE_RA_BRIDGE', invoiceId: origin, status: 'PENDING' }]);
  const history = await db.transactionHistory.findMany({ where: { invoice_id: origin } });
  expect(presentarResultado('ANULADO', null, history)?.origen).toBe('RA_REVERSAL_PENDING');
  expect(await h.service.procesar(h.row.id, origin)).toBe(true);
  expect(await h.service.procesar(h.row.id, origin)).toBe(true);
  expect(Number((await db.inventoryBalance.findFirstOrThrow({ where: { company_id: company } })).current_stock)).toBe(10);
  const inverse = await db.inventoryMovement.findMany({ where: { company_id: company, source_reference_id: { startsWith: `ra:${h.row.id}:` } } });
  expect(inverse).toHaveLength(1); expect(Number(inverse[0].total_cost)).toBe(300);
  const layer = await db.inventoryCostLayer.findFirstOrThrow({ where: { source_movement_id: inverse[0].id } });
  expect(Number(layer.unit_cost)).toBe(30);
  const entries = await db.accountingEntry.findMany({ where: { company_id: company }, include: { lines: true } });
  expect(entries).toHaveLength(4);
  for (const code of accounts) expect(entries.flatMap(e=>e.lines).filter(l=>l.account_code===code).reduce((s,l)=>s+Number(l.debit_amount)-Number(l.credit_amount),0)).toBe(0);
  expect(presentarResultado('ANULADO', null, await db.transactionHistory.findMany({ where: { invoice_id: origin } }))?.origen).not.toBe('RA_REVERSAL_PENDING');
 });
 it('fallo contable tras contramovimiento revierte también stock y capa; retry concurrente no duplica', async () => {
  const h = await prepare(); await h.store.finalizar(h.row,h.cdr,'0');
  await db.accountingPeriod.updateMany({ where: { company_id: company }, data: { status: 'CERRADO' } });
  expect(await h.service.procesar(h.row.id, origin)).toBe(false);
  expect(Number((await db.inventoryBalance.findFirstOrThrow({ where: { company_id: company } })).current_stock)).toBe(0);
  expect(await db.inventoryMovement.count({ where: { company_id: company, source_reference_id: { startsWith: 'ra:' } } })).toBe(0);
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(2);
  expect(raWorks((await db.invoiceAggregate.findUniqueOrThrow({ where: { id: h.row.id } })).result)[0]).toMatchObject({ status: 'PENDING', attempts: 1 });
  await db.accountingPeriod.updateMany({ where: { company_id: company }, data: { status: 'ABIERTO' } });
  await Promise.all([h.service.procesar(h.row.id, origin),h.service.procesar(h.row.id, origin)]);
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(4);
 });
 it('el CDR sobrevive al fallo de materialización y se recupera sin consultar SUNAT', async () => {
  const h = await prepare(); await db.invoice.update({ where:{id:origin},data:{estado:'RECHAZADO'} });
  await expect(h.store.finalizar(h.row,h.cdr,'0')).rejects.toThrow('SUMMARY_MEMBER_STATE_CHANGED');
  const row = await db.invoiceAggregate.findUniqueOrThrow({ where: { id: h.row.id } });
  expect((row.result as any).receivedCdr.contenido).toBe(h.cdr); expect(row.state).toBe('POLLING');
  await db.invoice.update({ where:{id:origin},data:{estado:'ACEPTADO'} });
  const dispatch = { encolar: jest.fn(), procesar: jest.fn() };
  await new SummaryEnvioService({} as never,dispatch as never,{} as never,{} as never,h.store,{} as never).recuperar();
  expect((await db.invoiceAggregate.findUniqueOrThrow({ where: { id: h.row.id } })).state).toBe('ACCEPTED');
  expect(dispatch.procesar).not.toHaveBeenCalled(); expect(dispatch.encolar).not.toHaveBeenCalled();
 });
 it('un miembro fallido no revierte ni repite el miembro ya completado', async () => {
  const h = await prepare(); await h.store.finalizar(h.row,h.cdr,'0');
  expect(await h.service.procesar(h.row.id, origin)).toBe(true);
  const row = await db.invoiceAggregate.findUniqueOrThrow({ where: { id: h.row.id } });
  const otherId = (await db.invoice.create({ data: { company_id:company,ruc_emisor:'20100070970',tipo_comprobante:'01',serie:'F002',correlativo:1,monto_total:1,fecha_emision:new Date(),payload_ubl:{},estado:'ACEPTADO' } })).id;
  await db.invoiceAggregate.update({ where: { id: row.id }, data: { result: { ...(row.result as object), bridgeReversals: [...raWorks(row.result), { action:'REVERSE_RA_BRIDGE',invoiceId:otherId,status:'PENDING',attempts:0,nextAt:new Date().toISOString() }] } } });
  expect(await h.service.procesar(h.row.id,otherId)).toBe(false);
  expect(raWorks((await db.invoiceAggregate.findUniqueOrThrow({ where:{ id:row.id } })).result)[0].status).toBe('DONE');
  expect(await db.accountingEntry.count({ where: { company_id: company } })).toBe(4);
 });
});
