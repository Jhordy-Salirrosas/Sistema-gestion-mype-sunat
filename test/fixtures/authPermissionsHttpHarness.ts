import { ValidationPipe, type Type, type Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/database/prismaService';
import { AuthGuard } from '../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../src/modules/auth/infrastructure/guards/rolesGuard';
import { ActionPermissionsGuard } from '../../src/modules/auth/infrastructure/guards/actionPermissionsGuard';
import { ActionPermissionsService } from '../../src/modules/auth/application/services/actionPermissionsService';
import { ModulePermissionsService } from '../../src/modules/auth/application/services/modulePermissionsService';
import { TOKEN_SERVICE_PORT } from '../../src/modules/auth/domain/ports/tokenServicePort';

export const actors = {
 admin: {sub:'admin',email:'admin@example.invalid',companyId:'empresa',role:'ADMIN'},
 operator: {sub:'operator',email:'operator@example.invalid',companyId:'empresa',role:'OPERADOR_FACTURACION'},
 auditor: {sub:'auditor',email:'auditor@example.invalid',companyId:'empresa',role:'AUDITOR'},
 contador: {sub:'contador',email:'contador@example.invalid',companyId:'empresa',role:'CONTADOR'},
 aduanas: {sub:'aduanas',email:'aduanas@example.invalid',companyId:'empresa',role:'OPERADOR_ADUANAS'},
 other: {sub:'other',email:'other@example.invalid',companyId:'otra',role:'OPERADOR_FACTURACION'},
};

export function permissionsPrisma() {
 const actions: any[]=[];const modules:any[]=[];
 const prisma:any={roleActionPermission:{
  findMany:jest.fn(async({where})=>actions.filter(row=>row.company_id===where.company_id&&(!where.role||row.role===where.role))),
  upsert:jest.fn(async({where,create,update})=>{
   const key=where.company_id_role_action_code;let row=actions.find(r=>r.company_id===key.company_id&&r.role===key.role&&r.action_code===key.action_code);
   if(row)Object.assign(row,update);else{row={...create};actions.push(row);}return row;
  }),
 },roleModulePermission:{findMany:jest.fn(async({where})=>modules.filter(row=>row.company_id===where.company_id&&(!where.role||row.role===where.role)))}};
 prisma.$transaction=jest.fn(async cb=>cb(prisma));
 return {prisma,actions,modules};
}

/** HTTP real de Nest con guards reales y servicios aislados de transporte fiscal. */
export async function permissionsHttpApp(controllers:Type[],prisma:any,overrides:Provider[]=[]) {
 const providers=new Map<any,Provider>();
 for(const controller of controllers)for(const type of Reflect.getMetadata('design:paramtypes',controller)??[]) {
  if(type)providers.set(type,{provide:type,useValue:{}});
 }
 const token={verifyToken:jest.fn((token:string)=>actors[token as keyof typeof actors]??null)};
 for(const p of [
  {provide:PrismaService,useValue:prisma},AuthGuard,RolesGuard,ActionPermissionsGuard,
  ActionPermissionsService,ModulePermissionsService,{provide:TOKEN_SERVICE_PORT,useValue:token},...overrides,
 ])providers.set(typeof p==='function'?p:(p as any).provide,p);
 const module=await Test.createTestingModule({controllers,providers:[...providers.values()]}).compile();
 const app=module.createNestApplication();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();
 return {app,module};
}
