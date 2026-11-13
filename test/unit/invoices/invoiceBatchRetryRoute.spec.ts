import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InvoicesModule } from '../../../src/modules/invoices/invoicesModule';
import { InvoiceBatchRetryService } from '../../../src/modules/invoices/application/services/invoiceBatchRetryService';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
it('GET y POST reales respetan el orden del módulo, el rol ADMIN y el tenant del token',async()=>{
 const controllers=Reflect.getMetadata('controllers',InvoicesModule);
 const tokens=[...new Set(controllers.flatMap((c:any)=>[...(Reflect.getMetadata('design:paramtypes',c) ?? []), ...(Reflect.getMetadata('self:paramtypes',c) ?? []).map((p:any)=>p.param)]))];
 const ejecutar=jest.fn(async(_tenant:string,previa=false)=>({fase:previa?'PREVIA':'EJECUTADA',elegibles:previa?1:0,encolados:previa?0:1,omitidos_incertidumbre:1,omitidos_rechazo_definitivo:1,omitidos_bloqueo_local:1,en_curso:0,ya_en_cola:0,omitidos_estado:0,no_confirmados:0,documentos:[]}));
 const detalle=jest.fn();
 const module=await Test.createTestingModule({controllers,providers:[
  ...tokens.map(provide=>({provide,useValue:provide===InvoiceBatchRetryService?{ejecutar}:provide===InvoiceQueryService?{detalle}:{}})),
  {provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:(t:string)=>t==='admin'?{companyId:'tenant-token',role:'ADMIN'}:t==='auditor'?{companyId:'tenant-token',role:'AUDITOR'}:t==='operador'?{companyId:'tenant-token',role:'OPERADOR_FACTURACION'}:null}},AuthGuard,RolesGuard,
 ]}).compile();const app=module.createNestApplication();await app.init();
 try {
  await request(app.getHttpServer()).get('/api/v1/invoices/retry-batch').expect(401);
  for(const role of ['auditor','operador'])for(const method of ['get','post'] as const)await request(app.getHttpServer())[method]('/api/v1/invoices/retry-batch').set('Authorization',`Bearer ${role}`).expect(403);
  const previa=await request(app.getHttpServer()).get('/api/v1/invoices/retry-batch?companyId=ajena').set('Authorization','Bearer admin').expect(200);
  expect(previa.body).toMatchObject({fase:'PREVIA',elegibles:1,omitidos_incertidumbre:1});
  expect(ejecutar).toHaveBeenLastCalledWith('tenant-token',true);
  const envio=await request(app.getHttpServer()).post('/api/v1/invoices/retry-batch').set('Authorization','Bearer admin').send({companyId:'ajena'}).expect(200);
  expect(envio.body).toMatchObject({fase:'EJECUTADA',encolados:1});expect(ejecutar).toHaveBeenLastCalledWith('tenant-token');expect(detalle).not.toHaveBeenCalled();
 }finally{await app.close();}
});
