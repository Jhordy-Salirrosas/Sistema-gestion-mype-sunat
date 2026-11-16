import { randomUUID } from 'node:crypto';
import { ActionPermissionsService } from '../../../src/modules/auth/application/services/actionPermissionsService';
import { rolesDatabase } from '../../fixtures/rolesDatabase';
import type { PrismaService } from '../../../src/database/prismaService';

(process.env.ROLES_TEST_DATABASE_URL?describe:describe.skip)('permisos por acción con PostgreSQL aislado',()=>{
 let db:PrismaService;let a:string;let b:string;let service:ActionPermissionsService;
 beforeAll(async()=>{db=await rolesDatabase();service=new ActionPermissionsService(db);
  for(const key of ['a','b']){const id=randomUUID();await db.company.create({data:{id,ruc:('2'+BigInt('0x'+id.replaceAll('-','').slice(0,9)).toString().padStart(10,'0').slice(-10)),legal_name:'Prueba permisos '+key,sol_user:'local',sol_pass_encrypted:'local'}});if(key==='a')a=id;else b=id;}
 });
 afterAll(async()=>{if(db){await db.company.deleteMany({where:{id:{in:[a,b].filter(Boolean)}}});await db.$disconnect();}});
 it('persiste override por empresa y conserva defaults de otra empresa',async()=>{
  await service.replace(a,[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true}]);
  expect((await service.forRole(a,'OPERADOR_FACTURACION')).find(r=>r.actionCode==='INVOICE_EDIT_ISSUE_DATE')?.allowed).toBe(true);
  expect((await service.forRole(b,'OPERADOR_FACTURACION')).find(r=>r.actionCode==='INVOICE_EDIT_ISSUE_DATE')?.allowed).toBe(false);
 });
 it('la restricción única serializa dos altas concurrentes del mismo permiso',async()=>{
  const data={company_id:a,role:'ADMIN' as const,action_code:'INVOICE_FORCE_RESEND',allowed:false};
  const results=await Promise.allSettled([db.roleActionPermission.create({data}),db.roleActionPermission.create({data})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'P2002'}});
  await expect(db.roleActionPermission.create({data:{...data,company_id:b}})).resolves.toMatchObject({company_id:b});
 });
 it('una denegación persistida de ADMIN se aplica y una matriz inválida no escribe',async()=>{
  await expect(service.assertAllowed(a,'ADMIN','INVOICE_FORCE_RESEND')).rejects.toMatchObject({status:403});
  const count=await db.roleActionPermission.count();
  await expect(service.replace(a,[{role:'ADMIN',actionCode:'OTRA',allowed:true}])).rejects.toMatchObject({status:400});
  expect(await db.roleActionPermission.count()).toBe(count);
 });
});
