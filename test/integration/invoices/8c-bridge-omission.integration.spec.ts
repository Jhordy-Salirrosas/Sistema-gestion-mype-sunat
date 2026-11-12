import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { presentarResultado } from '../../../src/modules/invoices/application/services/invoiceResultPresentation';
import { BRIDGE_OMITTED, BRIDGE_RESOLVED } from '../../../src/modules/invoices/application/services/invoiceBridgeOmission';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('8C C3: omisión durable por clasificación como servicio', () => {
 let db: PrismaService, company: string;
 let atomic: AtomicInvoiceCreationService, coordinator: InvoiceBridgeCoordinatorService;
 const old = process.env.DATABASE_URL;
 const accounts = ['121210','401110','701210','691110','201110'];
 const createdAccounts: string[] = [];
 const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job-simulado') };
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
  await db.invoice.create({ data: { company_id: company, ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', correlativo: 69, monto_total: 118, fecha_emision: new Date('2026-11-10'), estado: 'ACEPTADO', customer_identity_type: '6', customer_identity_number: '20100070970', payload_ubl: { almacen: 'ALM-01' },
   items: { create: [{ item_order: 1, item_code: 'MAT', description: 'Producto', quantity: 10, unit_value: 10, unit_price: 11.8, igv_affectation_type: '10', igv_amount: 18, total_amount: 118 }] } } });
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

 const sale=async(inventory=true)=>{
  await db.inventoryProduct.updateMany({where:{company_id:company},data:{is_inventory:inventory}});
  const manual=new RegisterManualMovementUseCase(undefined as never,undefined as never,undefined as never,undefined as never,undefined,db);
  if(inventory)await manual.execute({warehouse_code:'ALM-01',sku:'MAT',direction:'ENTRADA',quantity:10,unit_cost:30,operation_type_code:'02'},company);
  await db.invoiceSeries.create({data:{company_id:company,document_type:'01',series:'F002'}});
  const result=await atomic.emitir({tipo_comprobante:'01',serie:'F002',fecha_emision:'2026-11-11',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente',items:[{codigo:'MAT',descripcion:'Producto',cantidad:1,precioUnitario:11.8}]} as never,company,randomUUID());
  await db.invoice.update({where:{id:result.id},data:{estado:'ACEPTADO'}});return result;
 };
 it('producto convertido en servicio: omisión durable, incompleto, reentrega y resolución coherentes',async()=>{
  const invoice=await sale();
  expect((await db.invoice.findUniqueOrThrow({where:{id:invoice.id}})).payload_ubl).toMatchObject({m1InventorySnapshot:{MAT:true}});
  await db.inventoryProduct.updateMany({where:{company_id:company},data:{is_inventory:false}});
  for(let i=0;i<2;i++)expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:false,kardex:'PENDIENTE'});
  await expect(coordinator.registrarComoTrabajo(invoice.id,'ACEPTADO')).rejects.toThrow('M1_KARDEX_PENDING');
  const history=await db.transactionHistory.findMany({where:{invoice_id:invoice.id}});
  expect(history.filter(e=>e.codigo_error===BRIDGE_OMITTED)).toHaveLength(1);
  expect(JSON.parse(history.find(e=>e.codigo_error===BRIDGE_OMITTED)!.mensaje_error!)).toMatchObject({sku:'MAT',causa:'PRODUCT_CHANGED_TO_SERVICE'});
  expect(presentarResultado('ACEPTADO',null,history)).toMatchObject({origen:'BRIDGE_PENDING'});
  expect((await new InvoiceQueryService(db,{} as never).listar(company,{puente_pendiente:'true'})).total).toBe(1);
  expect(await db.inventoryMovement.count({where:{company_id:company,source_reference_id:invoice.numero}})).toBe(0);
  await db.inventoryProduct.updateMany({where:{company_id:company},data:{is_inventory:true}});
  expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:true});
  await coordinator.reprocesar(company,invoice.id);
  expect(await db.inventoryMovement.count({where:{company_id:company,source_reference_id:invoice.numero}})).toBe(1);
  expect(await db.transactionHistory.count({where:{invoice_id:invoice.id,codigo_error:BRIDGE_RESOLVED}})).toBe(1);
  expect(presentarResultado('ACEPTADO',null,await db.transactionHistory.findMany({where:{invoice_id:invoice.id}}))).toBeUndefined();
  expect((await new InvoiceQueryService(db,{} as never).listar(company,{puente_pendiente:'true'})).total).toBe(0);
 });
 it('servicio al crear no se confunde con conversión posterior',async()=>{
  const invoice=await sale(false);expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:true});
  expect(await db.transactionHistory.count({where:{invoice_id:invoice.id,codigo_error:BRIDGE_OMITTED}})).toBe(0);
 });
 it('histórico sin foto deja causa desconocida explícita y nunca inventa que cambió de tipo',async()=>{
  const invoice=await sale();const stored=await db.invoice.findUniqueOrThrow({where:{id:invoice.id}});const payload={...(stored.payload_ubl as any)};delete payload.m1InventorySnapshot;
  await db.invoice.update({where:{id:invoice.id},data:{payload_ubl:payload}});
  await db.inventoryProduct.updateMany({where:{company_id:company},data:{is_inventory:false}});
  expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:false});
  const e=await db.transactionHistory.findFirstOrThrow({where:{invoice_id:invoice.id,codigo_error:BRIDGE_OMITTED}});
  expect(JSON.parse(e.mensaje_error!).causa).toBe('INVENTORY_CLASSIFICATION_UNKNOWN');
 });
 it('una descarga ya registrada conserva su costo aunque el producto pase a servicio',async()=>{
  const invoice=await sale();expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:true});
  await db.inventoryProduct.updateMany({where:{company_id:company},data:{is_inventory:false}});
  expect(await coordinator.reprocesar(company,invoice.id)).toMatchObject({completo:true});
  expect(await db.transactionHistory.count({where:{invoice_id:invoice.id,codigo_error:BRIDGE_OMITTED}})).toBe(0);
 });
});
