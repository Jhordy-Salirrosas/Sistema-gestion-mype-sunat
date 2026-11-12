import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('8D: gratuita con inventario real y guarda de stock', () => {
 let db: PrismaService, company: string, ruc: string;
 const old = process.env.DATABASE_URL;
 const queue = { enqueueInvoiceInTx: jest.fn(async () => 'trabajo-local-simulado') };
 const line = () => ({ codigo:'CEM-001',descripcion:'Cemento',cantidad:2,unidad:'NIU',afectacion:'11',precioUnitario:0,valorUnitario:100 });
 beforeAll(async()=>{
  if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Solo PostgreSQL local desechable');
  process.env.DATABASE_URL=url;db=new PrismaService();await db.$connect();
 });
 beforeEach(async()=>{
  queue.enqueueInvoiceInTx.mockClear();company=randomUUID();ruc='2'+Date.now().toString().slice(-10);
  await db.company.create({data:{id:company,ruc,legal_name:'Empresa ficticia',sol_user:'fake',sol_pass_encrypted:'fake',...fakeFiscalAddress}});
  await db.inventoryWarehouse.create({data:{company_id:company,warehouse_code:'ALM-01',description:'Prueba'}});
  await db.inventoryProduct.create({data:{company_id:company,sku:'CEM-001',description:'Cemento',is_inventory:true,sale_price:118,tax_affectation:'10',sunat_unit_code:'NIU'}});
  await db.invoiceSeries.create({data:{company_id:company,document_type:'01',series:'F001'}});
  const manual=new RegisterManualMovementUseCase(undefined as never,undefined as never,undefined as never,undefined as never,undefined,db);
  await manual.execute({warehouse_code:'ALM-01',sku:'CEM-001',direction:'ENTRADA',quantity:10,unit_cost:30,operation_type_code:'02'},company);
 });
 afterEach(async()=>{
  await db.invoiceCreationRequest.deleteMany({where:{company_id:company}});await db.invoice.deleteMany({where:{company_id:company}});await db.invoiceSeries.deleteMany({where:{company_id:company}});
  await db.inventoryCostLayer.deleteMany({where:{company_id:company}});await db.inventoryMovement.deleteMany({where:{company_id:company}});await db.inventoryBalance.deleteMany({where:{company_id:company}});await db.inventoryProduct.deleteMany({where:{company_id:company}});await db.inventoryWarehouse.deleteMany({where:{company_id:company}});await db.company.delete({where:{id:company}});
 });
 afterAll(async()=>{if(db)await db.$disconnect();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;});
 it.each(['pantalla','fiscal'])('crea gratuita desde %s con entrada, saldo y producto inventariable reales',async ruta=>{
  const dto={tipo_comprobante:'01',serie:'F001',fecha_emision:'2026-11-12',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',items:[line()]};
  const atomic=new AtomicInvoiceCreationService(db,queue as never);
  const created=ruta==='pantalla'?await atomic.emitir(dto as never,company,randomUUID()):await atomic.create(traducirEmision(dto as never,{ruc,razonSocial:'Empresa ficticia'},1).dto as never,company,randomUUID());
  const stored=await db.invoice.findUniqueOrThrow({where:{id:created.id},include:{items:true}});
  expect(Number(stored.monto_total)).toBe(0);expect(stored.items[0].igv_affectation_type).toBe('11');expect(Number(stored.items[0].unit_price)).toBe(0);expect(Number(stored.items[0].unit_value)).toBe(100);expect(queue.enqueueInvoiceInTx).toHaveBeenCalledTimes(1);
  expect(Number((await db.inventoryBalance.findFirstOrThrow({where:{company_id:company}})).current_stock)).toBe(10);
 });
 it('conserva el mensaje exacto para discrepancia onerosa contra el mismo producto',async()=>{
  await expect(new StockValidationService(db).validar(company,[{...line(),afectacion:'20',precioUnitario:118}])).rejects.toThrow('La afectación tributaria del producto CEM-001 (10) viene de su configuración y no coincide con la enviada (20).');
 });
 it.each([{precioUnitario:1},{valorUnitario:0},{valorUnitario:undefined}])('no exceptúa una gratuita inválida: %j',async cambio=>{
  await expect(new StockValidationService(db).validar(company,[{...line(),...cambio}])).rejects.toThrow('no coincide con la enviada (11)');
 });
 it('la gratuidad no evita la comprobación de existencias',async()=>{
  await expect(new StockValidationService(db).validar(company,[{...line(),cantidad:11}])).rejects.toThrow('Stock insuficiente para emitir el comprobante');
 });
});
