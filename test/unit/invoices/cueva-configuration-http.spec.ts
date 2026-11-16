import { cuevaAuthTestImports, cuevaSecurityPrisma } from '../../fixtures/cuevaSecurityPrisma';
import { PrismaService } from '../../../src/database/prismaService';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigurationHubController, CONFIGURATION_LINKS } from '../../../src/modules/invoices/infrastructure/controllers/configurationHubController';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
it('catálogo reservado a ADMIN y destinos existentes sin pantallas duplicadas',async()=>{
  let role='AUDITOR'; const module=await Test.createTestingModule({imports:cuevaAuthTestImports,controllers:[ConfigurationHubController],providers:[AuthGuard,RolesGuard,{provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'actor',companyId:'tenant',role})}}]}).overrideProvider(PrismaService).useValue(cuevaSecurityPrisma(()=>({sub:'actor',companyId:'tenant',role}))).compile();
  const app=module.createNestApplication();await app.init();try {
    await request(app.getHttpServer()).get('/api/v1/configuration/links').expect(401);
    await request(app.getHttpServer()).get('/api/v1/configuration/links').set('Authorization','Bearer x').expect(403);
    role='ADMIN';const {body}=await request(app.getHttpServer()).get('/api/v1/configuration/links').set('Authorization','Bearer x').expect(200);expect(body).toEqual(CONFIGURATION_LINKS);
  } finally {await app.close();}
});
