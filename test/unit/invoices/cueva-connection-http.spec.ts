import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SunatConnectionTestController } from '../../../src/modules/invoices/infrastructure/controllers/sunatConnectionTestController';
import { SunatConnectionTestService } from '../../../src/modules/invoices/application/services/sunatConnectionTestService';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
it('diagnóstico exige ADMIN y obtiene la empresa del token, nunca del body',async()=>{
  let role='OPERADOR_FACTURACION';const test=jest.fn().mockResolvedValue({conectado:false});
  const module=await Test.createTestingModule({controllers:[SunatConnectionTestController],providers:[AuthGuard,RolesGuard,
    {provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'actor',companyId:'tenant',role})}},
    {provide:SunatConnectionTestService,useValue:{test}}]}).compile();
  const app=module.createNestApplication();await app.init();try {
    await request(app.getHttpServer()).post('/api/v1/invoices/connection-test').expect(401);
    await request(app.getHttpServer()).post('/api/v1/invoices/connection-test').set('Authorization','Bearer x').expect(403);
    expect(test).not.toHaveBeenCalled();role='ADMIN';
    await request(app.getHttpServer()).post('/api/v1/invoices/connection-test').set('Authorization','Bearer x').send({companyId:'other'}).expect(200);
    expect(test).toHaveBeenCalledWith('tenant');
  } finally {await app.close();}
});
