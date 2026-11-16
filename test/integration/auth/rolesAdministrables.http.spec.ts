import { Controller,Get,UseGuards,type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolesController } from '../../../src/modules/auth/infrastructure/controllers/rolesController';
import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import { RoleCatalogService } from '../../../src/modules/auth/application/services/roleCatalogService';
import { SessionMembershipService } from '../../../src/modules/auth/application/services/sessionMembershipService';
import { MenuPermissionsService } from '../../../src/modules/auth/application/services/menuPermissionsService';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { CapabilityGuard } from '../../../src/modules/auth/infrastructure/guards/capabilityGuard';
import { RequireCapability } from '../../../src/modules/auth/infrastructure/decorators/capabilityDecorator';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { permissionsHttpApp,permissionsPrisma,actors } from '../../fixtures/authPermissionsHttpHarness';
@Controller('api/v1/invoices')
@UseGuards(AuthGuard,CapabilityGuard)
class CapabilityProbe {
 @RequireCapability('INVOICE_CONFIG_EDIT') @Get('roles-probe') adminConfig(){return {ok:true};}
}
let app:INestApplication;let db:any;let members:any[];let roles:any[];let overrides:any[];
beforeAll(async()=>{
 const h=permissionsPrisma();db=h.prisma;overrides=h.actions;
 roles=['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR'].map(code=>({company_id:'empresa',code,name:code,is_system:true}));
 db.companyRole.findMany.mockImplementation(async({where})=>roles.filter(r=>r.company_id===where.company_id));
 db.companyRole.findUnique.mockImplementation(async({where:{company_id_code:k}})=>roles.find(r=>r.company_id===k.company_id&&r.code===k.code)??null);
 db.companyRole.update=jest.fn(async({where:{company_id_code:k},data})=>{const r=roles.find(r=>r.company_id===k.company_id&&r.code===k.code)!;Object.assign(r,data);return {...r};});
 db.user={findFirst:jest.fn(async({where})=>members.find(r=>r.id===where.id&&r.company_id===where.company_id)??null)};
 db.roleMenuPermission={findMany:jest.fn(async()=>[]),upsert:jest.fn()};
 const tokens={verifyToken:(value:string)=>actors[value as keyof typeof actors]??null};
 ({app}=await permissionsHttpApp([RolesController,AuthController,CapabilityProbe],db,[RoleCatalogService,MenuPermissionsService,SessionMembershipService,{provide:TOKEN_SERVICE_PORT,useValue:tokens}]));
});
beforeEach(()=>{members=Object.values(actors).map(a=>({id:a.sub,email:a.email,company_id:a.companyId,role:a.role,is_active:true,company:{is_active:true}}));roles.find(r=>r.code==='CONTADOR').name='CONTADOR';overrides.length=0;db.auditLog.create.mockClear();});
afterAll(async()=>app?.close());
const auth=(role='admin')=>({Authorization:'Bearer '+role});
it('solo ADMIN lista/renombra, rechaza code/is_system en body y protege ADMIN',async()=>{
 await request(app.getHttpServer()).get('/api/v1/auth/roles').expect(401);
 await request(app.getHttpServer()).get('/api/v1/auth/roles').set(auth('operator')).expect(403);
 const list=await request(app.getHttpServer()).get('/api/v1/auth/roles').set(auth()).expect(200);expect(list.body).toHaveLength(5);
 await request(app.getHttpServer()).patch('/api/v1/auth/roles/CONTADOR').set(auth()).send({name:'Contabilidad',code:'OTRO'}).expect(400);
 await request(app.getHttpServer()).patch('/api/v1/auth/roles/ADMIN').set(auth()).send({name:'Otro'}).expect(403);
 await request(app.getHttpServer()).patch('/api/v1/auth/roles/CONTADOR').set(auth('operator')).send({name:'Otro'}).expect(403);
});
it('renombra y la siguiente lectura de la misma sesión recibe el nombre nuevo',async()=>{
 await request(app.getHttpServer()).patch('/api/v1/auth/roles/CONTADOR').set(auth()).send({name:'Contabilidad'}).expect(200);
 const me=await request(app.getHttpServer()).get('/api/v1/auth/permissions/me').set(auth('contador')).expect(200);expect(me.body.role).toMatchObject({code:'CONTADOR',name:'Contabilidad'});expect(db.auditLog.create).toHaveBeenCalled();
});
it('resuelve rol vigente: un JWT ADMIN anterior no conserva gestión ni capacidades',async()=>{
 members.find(r=>r.id==='admin').role='OPERADOR_FACTURACION';
 await request(app.getHttpServer()).get('/api/v1/auth/roles').set(auth()).expect(403);
 await request(app.getHttpServer()).get('/api/v1/invoices/roles-probe').set(auth()).expect(403);
 const me=await request(app.getHttpServer()).get('/api/v1/auth/permissions/me').set(auth()).expect(200);expect(me.body.role.code).toBe('OPERADOR_FACTURACION');
});
it('rechaza usuario inactivo y pertenencia a otra empresa antes del handler',async()=>{
 members.find(r=>r.id==='admin').is_active=false;await request(app.getHttpServer()).get('/api/v1/auth/roles').set(auth()).expect(401);
 members.find(r=>r.id==='admin').is_active=true;members.find(r=>r.id==='admin').company_id='otra';await request(app.getHttpServer()).get('/api/v1/auth/roles').set(auth()).expect(401);
});
it('flag apagado informa false, rechaza alta y conserva los 72 menús técnicos',async()=>{
 const flag=await request(app.getHttpServer()).get('/api/v1/auth/roles/config').set(auth()).expect(200);expect(flag.body.customRolesEnabled).toBe(false);
 await request(app.getHttpServer()).post('/api/v1/auth/roles').set(auth()).send({code:'PROPIO',name:'Administrador'}).expect(403);
 const catalog=await request(app.getHttpServer()).get('/api/v1/auth/permission-catalog').set(auth()).expect(200);expect(catalog.body.menus).toHaveLength(72);
});
it('snapshot usa overrides y denegación ADMIN; el servidor impide nuevas mutaciones de autobloqueo',async()=>{
 overrides.push({company_id:'empresa',role:'ADMIN',action_code:'INVOICE_FORCE_RESEND',allowed:false});
 const me=await request(app.getHttpServer()).get('/api/v1/auth/permissions/me').set(auth()).expect(200);expect(me.body.actions.find(r=>r.actionCode==='INVOICE_FORCE_RESEND').allowed).toBe(false);
 await request(app.getHttpServer()).put('/api/v1/auth/action-permissions').set(auth()).send([{role:'ADMIN',actionCode:'INVOICE_EMIT',allowed:false}]).expect(403);
 expect(db.auditLog.create).not.toHaveBeenCalled();
});
