import { Test } from '@nestjs/testing';
import request = require('supertest');
import { InvoicesModule } from '../../../src/modules/invoices/invoicesModule';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';

function harness() {
  const rows = [
    { id: 'local', estado: 'RECHAZADO', company_id: 'c' },
    { id: 'final', estado: 'ACEPTADO', company_id: 'c' },
    { id: 'normal', estado: 'EN_COLA', company_id: 'c' },
    { id: 'ajeno', estado: 'ACEPTADO', company_id: 'otra' },
  ].map((r,i)=>({...r,tipo_comprobante:'01',serie:'F001',correlativo:i+1,fecha_emision:new Date('2026-11-12'),monto_total:118,currency_code:'PEN',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',sunat_response_code:null,taxable_operations:100,total_igv:18,created_at:new Date(),updated_at:new Date(),history:[]}));
  const matches=(r:typeof rows[number],w:any)=>r.company_id===w.company_id&&(!w.estado||r.estado===w.estado)&&(!w.id||typeof w.id==='string'?(!w.id||r.id===w.id):(!w.id.in||w.id.in.includes(r.id))&&(!w.id.notIn||!w.id.notIn.includes(r.id)));
  const tx={invoice:{findMany:jest.fn(async({where,skip=0,take=100}:any)=>rows.filter(r=>matches(r,where)).slice(skip,skip+take)),count:jest.fn(async({where}:any)=>rows.filter(r=>matches(r,where)).length),findFirst:jest.fn(async({where}:any)=>rows.find(r=>matches(r,where))??null)},$transaction:jest.fn(async(ops:any[])=>Promise.all(ops))};
  const queue={listDlq:jest.fn(async(_company:string)=>['local','local','final','ajeno','huérfano','sin identificar',null].map(comprobanteSerieNumero=>({comprobanteSerieNumero})))};
  return {tx,queue,service:new InvoiceQueryService(tx as never,queue as never)};
}
it('proyecta membresía vigente en lista y detalle sin historial y sin filtrar estados finales',async()=>{
 const h=harness();const page=await h.service.listar('c',{});
 expect(page.data.map(d=>[d.id,d.en_dlq])).toEqual([['local',true],['final',true],['normal',false]]);
 expect(page.total).toBe(3);expect(page.data.every(d=>!('historial' in d))).toBe(true);
 expect((await h.service.detalle('c','final')).en_dlq).toBe(true);
 expect((await h.service.detalle('c','normal')).en_dlq).toBe(false);
 await expect(h.service.detalle('c','ajeno')).rejects.toMatchObject({status:404});
 expect(h.queue.listDlq).toHaveBeenCalledWith('c');
});
it('filtra antes de contar/paginar, deduplica jobs y excluye huérfanos y otro tenant',async()=>{
 const h=harness();const one=await h.service.listar('c',{en_dlq:'true'},'1','1');const two=await h.service.listar('c',{en_dlq:'true'},'2','1');
 expect(one).toMatchObject({total:2,total_pages:2,page:1,data:[{id:'local',en_dlq:true}]});
 expect(two).toMatchObject({total:2,page:2,data:[{id:'final',en_dlq:true}]});
 expect((await h.service.listar('c',{en_dlq:'false'})).data.map(r=>r.id)).toEqual(['normal']);
 expect((await h.service.listar('c',{en_dlq:'true',estado:'ACEPTADO'})).data.map(r=>r.id)).toEqual(['final']);
});
it('DLQ vacía es conocida y no selecciona comprobantes',async()=>{
 const h=harness();h.queue.listDlq.mockResolvedValue([]);
 expect(await h.service.listar('c',{en_dlq:'true'})).toMatchObject({data:[],total:0,total_pages:1});
 expect((await h.service.detalle('c','normal')).en_dlq).toBe(false);
});
it('fallo de cola conserva lecturas fiscales con null y el filtro responde 503, no un falso vacío',async()=>{
 const h=harness();h.queue.listDlq.mockRejectedValue(new Error('Cola no disponible'));
 expect((await h.service.listar('c',{})).data.every(r=>r.en_dlq===null)).toBe(true);
 expect((await h.service.detalle('c','final')).en_dlq).toBeNull();
 await expect(h.service.listar('c',{en_dlq:'true'})).rejects.toMatchObject({status:503,response:{code:'DLQ_NO_DISPONIBLE'}});
});
it.each(['1','TRUE','', ['true','false'],{value:'true'}])('rechaza filtro inválido %j antes de leer la cola',async valor=>{
 const h=harness();await expect(h.service.listar('c',{en_dlq:valor as string})).rejects.toMatchObject({status:400});expect(h.queue.listDlq).not.toHaveBeenCalled();
});
it('GET real propaga en_dlq y pagina con el orden de controladores del módulo',async()=>{
 const h=harness();const controllers=Reflect.getMetadata('controllers',InvoicesModule);
 const tokens=[...new Set(controllers.flatMap((c:any)=>Reflect.getMetadata('design:paramtypes',c)??[]))];
 const module=await Test.createTestingModule({controllers,providers:tokens.map(provide=>({provide,useValue:provide===InvoiceQueryService?h.service:{}}))})
 .overrideGuard(AuthGuard).useValue({canActivate:(ctx:any)=>{ctx.switchToHttp().getRequest().user={companyId:'c'};return true;}}).overrideGuard(RolesGuard).useValue({canActivate:()=>true}).compile();
 const app=module.createNestApplication();await app.init();
 try{
  const r=await request(app.getHttpServer()).get('/api/v1/invoices?en_dlq=true&page=2&page_size=1').expect(200);
  expect(r.body).toMatchObject({total:2,total_pages:2,data:[{id:'final',en_dlq:true}]});
  expect((await request(app.getHttpServer()).get('/api/v1/invoices/final').expect(200)).body.en_dlq).toBe(true);
  await request(app.getHttpServer()).get('/api/v1/invoices?en_dlq=no').expect(400);
  await request(app.getHttpServer()).get('/api/v1/invoices').expect(200);
  await request(app.getHttpServer()).get('/api/v1/invoices?en_dlq=false&puente_pendiente=false').expect(200);
  h.queue.listDlq.mockRejectedValue(new Error('Cola caída'));
  await request(app.getHttpServer()).get('/api/v1/invoices?en_dlq=true').expect(503);
 }finally{await app.close();}
});
