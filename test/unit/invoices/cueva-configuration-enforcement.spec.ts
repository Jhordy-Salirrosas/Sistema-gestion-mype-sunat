import { cuevaAuthTestImports, cuevaSecurityPrisma } from '../../fixtures/cuevaSecurityPrisma';
import { PrismaService } from '../../../src/database/prismaService';
import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { ConfigurationAdminInterceptor } from '../../../src/common/interceptors/configurationAdminInterceptor';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
@Controller('api/v1') @UseGuards(AuthGuard)
class ConfigFixture {
 @Put('accounting/rules') rules(){return{ok:true};}
 @Put('master-data/currencies') currency(){return{ok:true};}
 @Put('master-data/partners/one') partner(){return{ok:true};}
 @Get('invoices/config') fiscal(){return{ok:true};}
 @Get('sire/configuracion/status') sire(){return{ok:true};}
}
it('la configuración exige ADMIN también al invocar endpoints directos; lectura compartida y alta de cliente siguen operativas',async()=>{
 let role='CONTADOR';const module=await Test.createTestingModule({imports:cuevaAuthTestImports,controllers:[ConfigFixture],providers:[AuthGuard,{provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'actor',companyId:'tenant',role})}},{provide:APP_INTERCEPTOR,useClass:ConfigurationAdminInterceptor}]}).overrideProvider(PrismaService).useValue(cuevaSecurityPrisma(()=>({sub:'actor',companyId:'tenant',role}))).compile();const app=module.createNestApplication();await app.init();
 try {const auth=(method:'get'|'put',url:string)=>request(app.getHttpServer())[method](url).set('Authorization','Bearer local');
  await auth('put','/api/v1/accounting/rules').expect(403);await auth('put','/API/V1/ACCOUNTING/RULES').expect(403);await auth('put','/api/v1/master-data/currencies').expect(403);await auth('get','/api/v1/sire/configuracion/status').expect(403);
  await auth('get','/api/v1/invoices/config').expect(200);await auth('put','/api/v1/master-data/partners/one').expect(200);
  role='ADMIN';await auth('put','/api/v1/accounting/rules').expect(200);await auth('put','/api/v1/master-data/currencies').expect(200);await auth('get','/api/v1/sire/configuracion/status').expect(200);
 } finally {await app.close();}
});
