import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { ControlSaldoNotas } from '../../../src/modules/invoices/application/services/creditNoteBalanceGuard';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { fechaFiscalLima } from '../../../src/modules/invoices/fiscalDate';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Cueva ND: saldo transaccional PostgreSQL local',()=>{
 let db:PrismaService,company:string,origin:string,atomic:AtomicInvoiceCreationService;const old=process.env.DATABASE_URL;
 const queue={enqueueInvoiceInTx:jest.fn(async()=> 'local-job')};
 const dto=(amount:number)=>({tipo_comprobante:'08',serie:'FD01',fecha_emision:fechaFiscalLima(),forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente',documento_afectado:'F001-00000001',codigo_motivo_nota:'02',items:[{codigo:'SERV',descripcion:'Servicio',cantidad:1,precioUnitario:amount,unidad:'NIU',afectacion:'10'}]});
 beforeAll(async()=>{if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Solo PostgreSQL local');process.env.DATABASE_URL=url;db=new PrismaService();await db.$connect();atomic=new AtomicInvoiceCreationService(db,queue as never);});
 beforeEach(async()=>{
  company=randomUUID();await db.company.create({data:{id:company,ruc:'2'+Date.now().toString().slice(-10),legal_name:'Empresa local ND',sol_user:'fake',sol_pass_encrypted:'fake',...fakeFiscalAddress}});
  await db.inventoryWarehouse.create({data:{company_id:company,warehouse_code:'ALM-01',description:'Local'}});
  await db.inventoryProduct.create({data:{company_id:company,sku:'SERV',description:'Servicio',is_inventory:false,sale_price:118,tax_affectation:'10',sunat_unit_code:'NIU'}});
  origin=(await db.invoice.create({data:{company_id:company,ruc_emisor:'20000000001',tipo_comprobante:'01',serie:'F001',correlativo:1,fecha_emision:new Date(fechaFiscalLima()),monto_total:118,estado:'ACEPTADO',customer_identity_type:'6',customer_identity_number:'20100070970',payload_ubl:{},items:{create:[{item_order:1,item_code:'SERV',description:'Servicio',quantity:1,unit_value:100,unit_price:118,unit_code:'NIU',igv_affectation_type:'10',igv_amount:18,total_amount:118}]}}})).id;
  await db.invoiceSeries.create({data:{company_id:company,document_type:'08',series:'FD01'}});
 });
 afterEach(async()=>{await db.invoiceCreationRequest.deleteMany({where:{company_id:company}});await db.invoice.deleteMany({where:{company_id:company,referenced_invoice_id:{not:null}}});await db.invoice.deleteMany({where:{company_id:company}});await db.invoiceSeries.deleteMany({where:{company_id:company}});await db.inventoryProduct.deleteMany({where:{company_id:company}});await db.inventoryWarehouse.deleteMany({where:{company_id:company}});await db.company.delete({where:{id:company}});});
 afterAll(async()=>{if(db)await db.$disconnect();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;});
 it.each(['pantalla','fiscal'])('%s: parcial, saldo persistido, total restante y exceso rechazado',async ruta=>{
  const issue=(amount:number)=>{const d=dto(amount);if(ruta==='pantalla')return atomic.emitir(d as never,company,randomUUID());const ruc='20000000001';return db.company.update({where:{id:company},data:{issuer_ruc:ruc}}).then(()=>atomic.create(traducirEmision(d as never,{ruc,razonSocial:'Local'},1).dto,company,randomUUID()));};
  const first=await issue(35.4);const stored=await db.invoice.findUniqueOrThrow({where:{id:first.id}});
  expect((stored.payload_ubl as any).m1NoteBalance).toEqual({antes:118,importe:35.4,restante:82.6});
  expect((await new ControlSaldoNotas(db).calcular(company,origin)).disponible).toBe(82.6);
  await issue(82.6);expect((await new ControlSaldoNotas(db).calcular(company,origin)).disponible).toBe(0);
  await expect(issue(0.01)).rejects.toThrow('NOTA_EXCEDE_SALDO');expect(await db.invoice.count({where:{company_id:company,tipo_comprobante:'08'}})).toBe(2);
 });
 it('dos ND concurrentes no consumen dos veces el mismo saldo',async()=>{
  const results=await Promise.allSettled([atomic.emitir(dto(80) as never,company,randomUUID()),atomic.emitir(dto(80) as never,company,randomUUID())]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect((await new ControlSaldoNotas(db).calcular(company,origin)).disponible).toBe(38);
 });
});
