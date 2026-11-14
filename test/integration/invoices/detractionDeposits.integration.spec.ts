import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { InvoiceDetractionService } from '../../../src/modules/invoices/application/services/invoiceDetractionService';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('movimientos de detracción, PostgreSQL local sin transporte', () => {
 let db: PrismaService; let service: InvoiceDetractionService; let companyId: string; let id: string; let number = 0;
 const originalDb = process.env.DATABASE_URL;
 beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl; db = new PrismaService(); await db.$connect();
  companyId = (await db.company.create({data:{ruc:`20${Date.now().toString().slice(-9)}`,legal_name:'Pruebas depósitos',sol_user:'MODDATOS',sol_pass_encrypted:'local'}})).id;
  service = new InvoiceDetractionService(db);
 });
 beforeEach(async () => {
  id = (await db.invoice.create({data:{company_id:companyId,ruc_emisor:'20000000001',serie:'F001',tipo_comprobante:'01',correlativo:++number,fecha_emision:new Date('2026-11-01'),estado:'ACEPTADO',monto_total:1000,payload_ubl:{montoDetraccion:100}}})).id;
 });
 afterAll(async () => {
  if (companyId) {
   await db.transactionHistory.deleteMany({where:{company_id:companyId}});
   await db.invoiceDetractionDeposit.deleteMany({where:{company_id:companyId}});
   await db.invoice.deleteMany({where:{company_id:companyId}});await db.company.delete({where:{id:companyId}});
  }
  await db?.$disconnect(); if(originalDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=originalDb;
 });
 const add = (amount: number, constancia?: string, date='2026-11-02') => service.registerDeposit(companyId,id,{amount,date,constancia},'actor-prueba');
 it('complementos, resumen compatible, saldo e historial con valores de cada movimiento', async () => {
  const first = await add(30,'001','2026-11-03');
  await add(70,'002','2026-11-04');
  await expect(add(0.01)).rejects.toThrow('El total depositado no puede superar');
  const rows = await service.list(companyId,'2026-11');
  const row = rows.find(r=>r.id===id)!;
  expect(row).toMatchObject({depositedTotal:100,depositedAmount:100,balance:0,constancia:'002'});
  expect(row.deposits.map(d=>d.amount)).toEqual([30,70]);
  await expect(service.registerDeposit(companyId,id,{amount:40,date:'2026-11-03',constancia:'003'},'editor',first.deposit.id)).rejects.toThrow('El total depositado no puede superar');
  await service.registerDeposit(companyId,id,{amount:20,date:'2026-11-03',constancia:'003'},'editor',first.deposit.id);
  const invoice = await db.invoice.findUniqueOrThrow({where:{id}});
  expect(Number(invoice.detraccion_deposited_amount)).toBe(90);
  expect(invoice.detraccion_constancia).toBe('002');
  expect(invoice.estado).toBe('ACEPTADO');
  const events=await db.transactionHistory.findMany({where:{invoice_id:id},orderBy:{created_at:'asc'}});
  expect(events).toHaveLength(3);
  expect(JSON.parse(events[0].mensaje_error!)).toMatchObject({actor:'actor-prueba',anterior:null,nuevo:{monto:30,constancia:'001'}});
  expect(JSON.parse(events[2].mensaje_error!)).toMatchObject({actor:'editor',anterior:{monto:30,constancia:'001'},nuevo:{monto:20,constancia:'003'}});
  const detail = await new InvoiceQueryService(db, {} as never).detalle(companyId,id);
  expect(JSON.stringify(detail.historial)).toContain('Usuario: editor');
 });
 it('lee constancias históricas sin alterarlas y exige dígitos al editar el movimiento', async () => {
  const movement=await db.invoiceDetractionDeposit.create({data:{company_id:companyId,invoice_id:id,date:new Date('2026-11-02'),amount:40,constancia:'ABC-histórica',legacy:true}});
  await db.invoice.update({where:{id},data:{detraccion_deposited_at:movement.date,detraccion_deposited_amount:40,detraccion_constancia:movement.constancia}});
  expect((await service.list(companyId,'2026-11')).find(r=>r.id===id)?.deposits[0].constancia).toBe('ABC-histórica');
  await expect(service.registerDeposit(companyId,id,{amount:40,date:'2026-11-02',constancia:'ABC-histórica'},'editor',movement.id)).rejects.toThrow('solo dígitos');
  await service.registerDeposit(companyId,id,{amount:40,date:'2026-11-02',constancia:'004'},'editor',movement.id);
  expect((await db.invoiceDetractionDeposit.findUniqueOrThrow({where:{id:movement.id}})).legacy).toBe(false);
  const event=await db.transactionHistory.findFirstOrThrow({where:{invoice_id:id}});
  expect(JSON.parse(event.mensaje_error!)).toMatchObject({anterior:{constancia:'ABC-histórica'},nuevo:{constancia:'004'}});
 });
 it('serializa altas concurrentes sin superar el límite', async () => {
  const results = await Promise.allSettled([add(70,'01'),add(70,'02')]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect(await db.invoiceDetractionDeposit.count({where:{invoice_id:id}})).toBe(1);
  expect(Number((await db.invoice.findUniqueOrThrow({where:{id}})).detraccion_deposited_amount)).toBe(70);
  expect(await db.transactionHistory.count({where:{invoice_id:id}})).toBe(1);
 });
 it('revierte movimiento y resumen si falla la escritura del historial', async () => {
  const failing = new InvoiceDetractionService({$transaction:(fn: any)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,key){
   if(key==='transactionHistory') return {create:async()=>{throw new Error('historial no disponible');}};
   const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }})))} as never);
  await expect(failing.registerDeposit(companyId,id,{amount:30,date:'2026-11-02'},'actor')).rejects.toThrow('historial no disponible');
  expect(await db.invoiceDetractionDeposit.count({where:{invoice_id:id}})).toBe(0);
  expect((await db.invoice.findUniqueOrThrow({where:{id}})).detraccion_deposited_amount).toBeNull();
 });
 it('no permite editar movimientos de otra factura o empresa', async () => {
  const first=await add(10,'001');
  await expect(service.registerDeposit(randomUUID(),id,{amount:5,date:'2026-11-02'},'actor',first.deposit.id)).rejects.toThrow('Comprobante no encontrado');
  await expect(service.registerDeposit(companyId,id,{amount:5,date:'2026-11-02'},'actor',randomUUID())).rejects.toThrow('Depósito no encontrado');
  expect(await db.transactionHistory.count({where:{invoice_id:id}})).toBe(1);
 });
 it('acepta céntimos exactos, constancia vacía y complemento anterior sin cambiar la última fecha', async () => {
  await add(0.01,'001','2026-11-04');await add(99.99,undefined,'2026-11-02');
  const row=(await service.list(companyId,'2026-11')).find(r=>r.id===id)!;
  expect(row).toMatchObject({depositedTotal:100,balance:0,constancia:'001'});
  expect(row.deposits[0].constancia).toBeNull();
 });
});
