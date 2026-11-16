import { initializeCompanyRoles } from '../../../src/modules/auth/application/services/roleCatalogService';
import { SessionMembershipService } from '../../../src/modules/auth/application/services/sessionMembershipService';
import { randomUUID } from 'node:crypto';
import { CreateUserService } from '../../../src/modules/auth/application/services/createUserService';
import { NativeCryptoHasherAdapter } from '../../../src/modules/auth/infrastructure/security/nativeCryptoHasherAdapter';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { PrismaUserRepositoryAdapter } from '../../../src/modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';
import { rolesDatabase } from '../../fixtures/rolesDatabase';
import type { PrismaService } from '../../../src/database/prismaService';
(process.env.ROLES_TEST_DATABASE_URL?describe:describe.skip)('alta de usuarios con PostgreSQL aislado',()=>{
 let db:PrismaService;let a:string;let b:string;let service:CreateUserService;let email:string;
 const hasher=new NativeCryptoHasherAdapter();const password='StrongPass123!';
 beforeAll(async()=>{db=await rolesDatabase();service=new CreateUserService(db,hasher);email=`${randomUUID()}@example.invalid`;
  for(const key of ['a','b']){const id=randomUUID();await db.company.create({data:{id,ruc:'2'+BigInt('0x'+id.replaceAll('-','').slice(0,9)).toString().padStart(10,'0').slice(-10),legal_name:'Alta usuarios '+key,sol_user:'local',sol_pass_encrypted:'local'}});await db.$transaction(tx=>initializeCompanyRoles(tx,id));if(key==='a')a=id;else b=id;}
 });
 afterAll(async()=>{if(db){await db.auditLog.deleteMany({where:{company_id:{in:[a,b].filter(Boolean)}}});await db.roleMenuPermission.deleteMany({where:{company_id:{in:[a,b].filter(Boolean)}}});const ids=[a,b].filter(Boolean);await db.user.deleteMany({where:{company_id:{in:ids}}});await db.company.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}});
 it('persiste hash compatible y el usuario inicia sesión inmediatamente con empresa y rol correctos',async()=>{
  const created=await service.create(a,{name:'Usuario local',email,password,role:'AUDITOR'});expect(created).toMatchObject({email,companyId:a,isActive:true,role:'AUDITOR'});expect(created).not.toHaveProperty('password_hash');
  const stored=await db.user.findUniqueOrThrow({where:{email}});expect(stored.password_hash).not.toBe(password);expect(await hasher.compare(password,stored.password_hash)).toBe(true);
  const tokens=new NativeJwtAdapter({get:()=> 'roles-local-test-jwt-secret-at-least-32-characters'} as never);
  const login=new LoginUseCase(new PrismaUserRepositoryAdapter(db),hasher,tokens,new SessionMembershipService(db));
  const response=await login.execute({email:email.toUpperCase(),password});expect(response.user).toMatchObject({id:created.id,companyId:a,role:'AUDITOR'});
  expect(tokens.verifyToken(response.accessToken)).toMatchObject({sub:created.id,companyId:a,role:'AUDITOR'});
  await expect(login.execute({email,password:'IncorrectPass123!'})).rejects.toMatchObject({status:401});
 });
 it('el índice único y el servicio rechazan el correo de otra empresa',async()=>{
  await expect(db.user.create({data:{company_id:b,email,password_hash:'local',full_name:'Duplicado',role:'CONTADOR'}})).rejects.toMatchObject({code:'P2002'});
  await expect(service.create(b,{name:'Duplicado',email,password,role:'CONTADOR'})).rejects.toMatchObject({status:409});
  expect(await db.user.count({where:{email}})).toBe(1);
 });
 it('dos altas en empresas distintas no pueden apropiarse del mismo correo',async()=>{
  const race=`${randomUUID()}@example.invalid`;
  const results=await Promise.allSettled([a,b].map(company=>service.create(company,{name:'Concurrente',email:race,password,role:'OPERADOR_FACTURACION'})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
  expect(await db.user.count({where:{email:race}})).toBe(1);
 });
});
