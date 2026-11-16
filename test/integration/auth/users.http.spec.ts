import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import { CreateUserService } from '../../../src/modules/auth/application/services/createUserService';
import { NativeCryptoHasherAdapter } from '../../../src/modules/auth/infrastructure/security/nativeCryptoHasherAdapter';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { PrismaUserRepositoryAdapter } from '../../../src/modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';
import { HASHER_PORT } from '../../../src/modules/auth/domain/ports/hasherPort';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { actors, permissionsHttpApp, permissionsPrisma } from '../../fixtures/authPermissionsHttpHarness';
let app:INestApplication;const users=new Map<string,any>();const hasher=new NativeCryptoHasherAdapter();
const native=new NativeJwtAdapter({get:()=> 'local-roles-jwt-secret-with-at-least-32-characters'} as never);
const tokens={verifyToken:(token:string)=>actors[token as keyof typeof actors]??native.verifyToken(token),signToken:native.signToken.bind(native),generateRefreshToken:native.generateRefreshToken.bind(native),hashToken:native.hashToken.bind(native)};
let db:any;
const input={name:'Nuevo usuario',email:'nuevo@example.invalid',password:'StrongPass123!',role:'OPERADOR_FACTURACION'};
beforeAll(async()=>{
 db=permissionsPrisma().prisma;
 db.user={findFirst:jest.fn(async({where})=>users.get(typeof where.email==='string'?where.email:where.email.equals)??null),
  create:jest.fn(async({data})=>{if(users.has(data.email))throw {code:'P2002'};const row={id:randomUUID(),...data};users.set(data.email,row);return row;}),
 };
 db.company={findUnique:jest.fn(async({where})=>({id:where.id,ruc:'20601234567',legal_name:'Empresa pruebas',sol_user:'local',sol_pass_encrypted:'local',is_active:true}))};
 db.refreshToken={create:jest.fn(async({data})=>({id:randomUUID(),...data}))};
 const login=new LoginUseCase(new PrismaUserRepositoryAdapter(db),hasher,tokens);
 ({app}=await permissionsHttpApp([AuthController],db,[CreateUserService,{provide:HASHER_PORT,useValue:hasher},{provide:LoginUseCase,useValue:login},{provide:TOKEN_SERVICE_PORT,useValue:tokens}]));
});
afterAll(async()=>app?.close());beforeEach(()=>{users.clear();jest.clearAllMocks();});
it('solo ADMIN puede crear: 401 sin token y 403 con otro rol',async()=>{
 await request(app.getHttpServer()).post('/api/v1/auth/users').send(input).expect(401);
 for(const role of ['operator','auditor','contador','aduanas'])await request(app.getHttpServer()).post('/api/v1/auth/users').set('Authorization',`Bearer ${role}`).send(input).expect(403);
 expect(db.user.create).not.toHaveBeenCalled();
});
it('crea en la empresa del token, sin hash, y permite login inmediato con el rol asignado',async()=>{
 const created=await request(app.getHttpServer()).post('/api/v1/auth/users').set('Authorization','Bearer admin').send({...input,name:' Nuevo usuario ',email:' NUEVO@EXAMPLE.INVALID '}).expect(201);
 expect(created.body).toMatchObject({companyId:'empresa',email:input.email,fullName:input.name,role:input.role,isActive:true});
 expect(created.body).not.toHaveProperty('password_hash');expect(created.body).not.toHaveProperty('password');
 expect(await hasher.compare(input.password,users.get(input.email).password_hash)).toBe(true);
 const login=await request(app.getHttpServer()).post('/api/v1/auth/login').send({email:input.email,password:input.password}).expect(200);
 expect(login.body.user).toMatchObject({id:created.body.id,companyId:'empresa',role:input.role});
 expect(native.verifyToken(login.body.accessToken)).toMatchObject({companyId:'empresa',role:input.role});
 await request(app.getHttpServer()).get('/api/v1/auth/action-permissions/me').set('Authorization',`Bearer ${login.body.accessToken}`).expect(200);
});
it('rechaza correo ocupado en otra empresa sin crear ni reasignar el usuario',async()=>{
 users.set(input.email,{id:'ajeno',company_id:'otra',email:input.email,password_hash:'ajeno'});
 await request(app.getHttpServer()).post('/api/v1/auth/users').set('Authorization','Bearer admin').send(input).expect(409);
 expect(users.get(input.email).company_id).toBe('otra');expect(db.user.create).not.toHaveBeenCalled();
});
it.each([{companyId:'otra'},{company_id:'otra'},{role:'OTRO'},{name:' '},{email:'invalido'},{password:'NoSpecial123'}])('rechaza datos inválidos o empresa elegida desde el cuerpo: %j',async patch=>{
 await request(app.getHttpServer()).post('/api/v1/auth/users').set('Authorization','Bearer admin').send({...input,...patch}).expect(400);expect(db.user.create).not.toHaveBeenCalled();
});
it('dos solicitudes simultáneas con el mismo correo producen una sola alta',async()=>{
 const responses=await Promise.all([1,2].map(()=>request(app.getHttpServer()).post('/api/v1/auth/users').set('Authorization','Bearer admin').send(input)));
 expect(responses.map(r=>r.status).sort()).toEqual([201,409]);expect(users.size).toBe(1);
});
