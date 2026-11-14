import { Test } from '@nestjs/testing';
import request = require('supertest');
import { InvoicesModule } from '../../../src/modules/invoices/invoicesModule';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { InvoiceDetractionService } from '../../../src/modules/invoices/application/services/invoiceDetractionService';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
it('GET literal y POST de detracciones funcionan con el orden real del módulo', async()=>{
 const controllers=Reflect.getMetadata('controllers',InvoicesModule);
 const tokens=[...new Set(controllers.flatMap((c:any)=>[...(Reflect.getMetadata('design:paramtypes',c) ?? []), ...(Reflect.getMetadata('self:paramtypes',c) ?? []).map((p:any)=>p.param)]))];
 const detalle=jest.fn();
 const findMany=jest.fn(async()=>[{id:'a',serie:'F001',correlativo:1,fecha_emision:new Date('2026-11-01'),monto_total:118,payload_ubl:{montoDetraccion:12},detraccion_deposited_at:null,detraccion_deposited_amount:0,customer_legal_name:null},{id:'b',serie:'F001',correlativo:2,fecha_emision:new Date('2026-11-02'),monto_total:118,payload_ubl:{},detraccion_deposited_amount:0}]);
 const service=new InvoiceDetractionService({invoice:{findMany}} as never);
 const registerDeposit=jest.spyOn(service,'registerDeposit').mockResolvedValue({id:'a'} as never);
 const module=await Test.createTestingModule({controllers,providers:tokens.map(provide=>({provide,useValue:provide===InvoiceQueryService?{detalle}:provide===InvoiceDetractionService?service:{}}))})
 .overrideGuard(AuthGuard).useValue({canActivate:(ctx:any)=>{ctx.switchToHttp().getRequest().user={companyId:'c',sub:'usuario'};return true;}}).overrideGuard(RolesGuard).useValue({canActivate:()=>true}).compile();
 const app=module.createNestApplication();await app.init();
 try {
  const r=await request(app.getHttpServer()).get('/api/v1/invoices/detractions?period=2026-11').expect(200);
  expect(r.body).toEqual([expect.objectContaining({id:'a',detraction:12,depositedAmount:null})]);
  expect(detalle).not.toHaveBeenCalled();
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({company_id:'c',estado:{in:['ACEPTADO','OBSERVADO']}})}));
  await request(app.getHttpServer()).post('/api/v1/invoices/detractions/a').send({amount:12}).expect(200);
  expect(registerDeposit).toHaveBeenCalledWith('c','a',{amount:12},'usuario');
  await request(app.getHttpServer()).put('/api/v1/invoices/detractions/a/deposits/m1').send({amount:10}).expect(200);
  expect(registerDeposit).toHaveBeenLastCalledWith('c','a',{amount:10},'usuario','m1');
 } finally {await app.close();}
});
