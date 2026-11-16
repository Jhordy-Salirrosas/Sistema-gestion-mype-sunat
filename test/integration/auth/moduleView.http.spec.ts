import { Controller,Get,Post,UseGuards,type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { ModuleWriteInterceptor } from '../../../src/modules/auth/infrastructure/interceptors/moduleWriteInterceptor';
import { ModulePermissionsService } from '../../../src/modules/auth/application/services/modulePermissionsService';
import { permissionsHttpApp,permissionsPrisma } from '../../fixtures/authPermissionsHttpHarness';
const handler=jest.fn(()=>({ok:true}));
@Controller('api/v1')
@UseGuards(AuthGuard)
class ReadProbe {
 @Get(':module') root(){return handler();}
 @Get(':module/:item') item(){return handler();}
 @Post(':module') write(){return handler();}
}
let app:INestApplication;let db:ReturnType<typeof permissionsPrisma>;
beforeAll(async()=>{db=permissionsPrisma();({app}=await permissionsHttpApp([AuthController,ReadProbe],db.prisma,[],[new ModuleWriteInterceptor(new ModulePermissionsService(db.prisma))]));});
afterAll(async()=>app?.close());beforeEach(()=>{db.modules.length=0;handler.mockClear();});
const auth=(role='operator')=>`Bearer ${role}`;
it('un rol con write=true y view=false recibe 403 al leer sin ejecutar el handler',async()=>{
 db.modules.push({company_id:'empresa',role:'OPERADOR_FACTURACION',module_code:'M1',can_view:false,can_write:true});
 await request(app.getHttpServer()).get('/api/v1/invoices').set('Authorization',auth()).expect(403);
 await request(app.getHttpServer()).head('/api/v1/invoices').set('Authorization',auth()).expect(403);
 expect(handler).not.toHaveBeenCalled();await request(app.getHttpServer()).post('/api/v1/invoices').set('Authorization',auth()).send({}).expect(201);
});
it.each([
 ['inventory/purchases','M8'],['inventory','M6'],['purchases','M8'],['purchase-orders','M8'],['invoices','M1'],['customs','M2'],['sire','M3'],['accounting','M4'],['treasury','M4'],['expenses','M4'],['sales','M7'],['warehouses','M6'],
])('GET %s aplica el módulo existente %s',async(path,moduleCode)=>{
 db.modules.push({company_id:'empresa',role:'CONTADOR',module_code:moduleCode,can_view:false,can_write:true});
 await request(app.getHttpServer()).get(`/api/v1/${path}?page=1`).set('Authorization',auth('contador')).expect(403);expect(handler).not.toHaveBeenCalled();
});
it('los defaults permiten lectura al auditor y mantienen su bloqueo de escritura',async()=>{
 await request(app.getHttpServer()).get('/api/v1/customs').set('Authorization',auth('auditor')).expect(200);
 await request(app.getHttpServer()).post('/api/v1/customs').set('Authorization',auth('auditor')).send({}).expect(403);
 await request(app.getHttpServer()).get('/api/v1/customs').set('Authorization',auth()).expect(403);
});
it('auth/master-data y prefijos no mapeados conservan acceso y separan empresas',async()=>{
 for(const code of ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10'])db.modules.push({company_id:'empresa',role:'OPERADOR_FACTURACION',module_code:code,can_view:false,can_write:false});
 await request(app.getHttpServer()).get('/api/v1/auth/module-permissions/me').set('Authorization',auth()).expect(200);
 for(const path of ['master-data/partners','resilience/jobs','health','invoices-extra/items'])await request(app.getHttpServer()).get(`/api/v1/${path}`).set('Authorization',auth()).expect(200);
 await request(app.getHttpServer()).get('/api/v1/invoices').set('Authorization',auth('other')).expect(200);
 await request(app.getHttpServer()).get('/api/v1/invoices').expect(401);
});
it('ADMIN respeta can_view persistido y conserva su excepción de escritura',async()=>{
 db.modules.push({company_id:'empresa',role:'ADMIN',module_code:'M1',can_view:false,can_write:false});
 await request(app.getHttpServer()).get('/api/v1/invoices').set('Authorization',auth('admin')).expect(403);
 await request(app.getHttpServer()).post('/api/v1/invoices').set('Authorization',auth('admin')).send({}).expect(201);
});
