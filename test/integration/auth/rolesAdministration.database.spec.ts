import { randomUUID } from 'node:crypto';
import { rolesDatabase } from '../../fixtures/rolesDatabase';
import { initializeCompanyRoles,RoleCatalogService } from '../../../src/modules/auth/application/services/roleCatalogService';
import { WarehouseAccessService } from '../../../src/modules/auth/application/services/warehouseAccessService';
import { ActionPermissionsService } from '../../../src/modules/auth/application/services/actionPermissionsService';
import type { PrismaService } from '../../../src/database/prismaService';
(process.env.ROLES_TEST_DATABASE_URL?describe:describe.skip)('administración transaccional en PostgreSQL local',()=>{
 let db:PrismaService;let c:string;let a:string;let b:string;
 beforeAll(async()=>{db=await rolesDatabase();c=randomUUID();a=randomUUID();b=randomUUID();await db.$transaction(async tx=>{await tx.company.create({data:{id:c,ruc:'2'+BigInt('0x'+c.replaceAll('-','').slice(0,9)).toString().padStart(10,'0').slice(-10),legal_name:'Roles local',sol_user:'local',sol_pass_encrypted:'local'}});await initializeCompanyRoles(tx,c);await tx.user.createMany({data:[a,b].map(id=>({id,company_id:c,email:id+'@example.invalid',full_name:'Admin local',password_hash:'local',role:'ADMIN' as const,is_active:true}))});});});
 afterAll(async()=>{if(db){await db.auditLog.deleteMany({where:{company_id:c}});await db.user.deleteMany({where:{company_id:c}});await db.roleMenuPermission.deleteMany({where:{company_id:c}});await db.company.delete({where:{id:c}});await db.$disconnect();}});
 it('renombra sin cambiar código y conserva actor/empresa/antes/después',async()=>{await new RoleCatalogService(db).rename(c,'CONTADOR','Contabilidad local',a);expect(await db.companyRole.findUnique({where:{company_id_code:{company_id:c,code:'CONTADOR'}}})).toMatchObject({name:'Contabilidad local',is_system:true});const event=await db.auditLog.findFirstOrThrow({where:{company_id:c,action:'ROLE_RENAME'}});expect(event.user_id).toBe(a);expect(event.previous_values).toMatchObject({code:'CONTADOR',name:'Contador'});expect(event.new_values).toMatchObject({code:'CONTADOR',name:'Contabilidad local'});});
 it('el bloqueo por empresa evita desactivar a los dos ADMIN concurrentemente',async()=>{const service=new WarehouseAccessService(db);const results=await Promise.allSettled([service.updateUser(c,a,b,{isActive:false}),service.updateUser(c,b,a,{isActive:false})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await db.user.count({where:{company_id:c,role:'ADMIN',is_active:true}})).toBe(1);});
 it('auditoría y permiso se revierten juntos ante error de actor FK',async()=>{const service=new ActionPermissionsService(db);await expect(service.replace(c,[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true}],'actor-inexistente')).rejects.toBeDefined();expect(await db.roleActionPermission.count({where:{company_id:c,role:'OPERADOR_FACTURACION'}})).toBe(0);});
 it('la API de permisos no permite bloquear ADMIN ni cambiar el propio rol',async()=>{const admin=await db.user.findFirstOrThrow({where:{company_id:c,role:'ADMIN',is_active:true}});await expect(new WarehouseAccessService(db).updateUser(c,admin.id,admin.id,{role:'AUDITOR'})).rejects.toMatchObject({status:400});await expect(new ActionPermissionsService(db).replace(c,[{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:false}],admin.id)).rejects.toMatchObject({status:403});});
 it('audita el estado persistido antes/después, no campos adicionales del request',async()=>{
  const admin=await db.user.findFirstOrThrow({where:{company_id:c,role:'ADMIN',is_active:true}});
  await new ActionPermissionsService(db).replace(c,[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true,company_id:'ajena'}],admin.id);
  const event=await db.auditLog.findFirstOrThrow({where:{company_id:c,action:'ROLE_ACTION_PERMISSIONS'}});
  expect(event.user_id).toBe(admin.id);expect(event.previous_values).toEqual([]);
  expect(event.new_values).toEqual(expect.arrayContaining([expect.objectContaining({company_id:c,role:'OPERADOR_FACTURACION',action_code:'INVOICE_EDIT_ISSUE_DATE',allowed:true})]));
  expect(JSON.stringify(event.new_values)).not.toContain('ajena');
 });

 it('conserva un override antiguo inactivo y permite nuevas concesiones explícitas a roles de sistema',async()=>{
  const admin=await db.user.findFirstOrThrow({where:{company_id:c,role:'ADMIN',is_active:true}});const service=new ActionPermissionsService(db);
  await db.roleActionPermission.create({data:{company_id:c,role:'OPERADOR_FACTURACION',action_code:'INVOICE_FORCE_RESEND',allowed:true}});
  await expect(service.assertAllowed(c,'OPERADOR_FACTURACION','INVOICE_FORCE_RESEND')).rejects.toMatchObject({status:403});
  await service.replace(c,[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_FORCE_RESEND_ACCESS',allowed:true}],admin.id);
  await expect(service.assertAllowed(c,'OPERADOR_FACTURACION','INVOICE_FORCE_RESEND')).resolves.toBeUndefined();
  await service.replace(c,[{role:'CONTADOR',actionCode:'INVOICE_EMIT',allowed:true}],admin.id);
  await expect(service.assertAllowed(c,'CONTADOR','INVOICE_EMIT')).resolves.toBeUndefined();
 });

});
