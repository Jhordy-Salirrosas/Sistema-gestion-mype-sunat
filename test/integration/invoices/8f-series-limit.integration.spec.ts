import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { InvoiceSeriesService } from '../../../src/modules/invoices/application/services/invoiceSeriesService';
const url=process.env.TEST_DATABASE_URL;
(url?describe:describe.skip)('8F: agotamiento atómico PostgreSQL',()=>{
 let db:PrismaService,company:string;const old=process.env.DATABASE_URL;
 beforeAll(async()=>{
  if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Solo base local');
  process.env.DATABASE_URL=url;db=new PrismaService();await db.$connect();company=randomUUID();
  await db.company.create({data:{id:company,ruc:'2'+Date.now().toString().slice(-10),legal_name:'Empresa ficticia',sol_user:'fake',sol_pass_encrypted:'fake'}});
  await db.invoiceSeries.create({data:{company_id:company,document_type:'01',series:'F001',current_correlative:99999998}});
 });
 afterAll(async()=>{if(db){await db.invoiceSeries.deleteMany({where:{company_id:company}});await db.company.delete({where:{id:company}});await db.$disconnect();}if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;});
 it('dos solicitudes: una recibe el último número y otra SERIE_AGOTADA',async()=>{
  const svc=new InvoiceSeriesService(db);
  const results=await Promise.allSettled([svc.reservarCorrelativo(company,'01','F001'),svc.reservarCorrelativo(company,'01','F001')]);
  expect(results.filter(r=>r.status==='fulfilled')).toEqual([{status:'fulfilled',value:99999999}]);
  const failure=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
  expect(failure.reason.getStatus()).toBe(409);expect(failure.reason.getResponse()).toMatchObject({code:'SERIE_AGOTADA'});
  expect((await db.invoiceSeries.findFirstOrThrow({where:{company_id:company}})).current_correlative).toBe(99999999);
  await expect(svc.reservarCorrelativo(company,'01','F001')).rejects.toThrow('SERIE_AGOTADA');
 });
 it('alta/reactivación no admite inicial de nueve dígitos ni reinicia agotada',async()=>{
  const svc=new InvoiceSeriesService(db);
  await expect(svc.asegurarSerie({companyId:company,documentType:'01',series:'F001',correlativoInicial:100000000})).rejects.toThrow('entre 0 y 99999999');
  await svc.asegurarSerie({companyId:company,documentType:'01',series:'F001',correlativoInicial:0});
  expect((await db.invoiceSeries.findFirstOrThrow({where:{company_id:company}})).current_correlative).toBe(99999999);
 });
});
