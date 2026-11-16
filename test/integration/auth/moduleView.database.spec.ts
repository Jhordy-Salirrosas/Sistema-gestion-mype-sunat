import { randomUUID } from 'node:crypto';
import { ModulePermissionsService } from '../../../src/modules/auth/application/services/modulePermissionsService';
import { rolesDatabase } from '../../fixtures/rolesDatabase';
import type { PrismaService } from '../../../src/database/prismaService';
(process.env.ROLES_TEST_DATABASE_URL?describe:describe.skip)('lectura por módulo con PostgreSQL aislado',()=>{
 let db:PrismaService;let company:string;let other:string;let service:ModulePermissionsService;
 beforeAll(async()=>{db=await rolesDatabase();service=new ModulePermissionsService(db);for(const key of ['a','b']){
  const id=randomUUID();await db.company.create({data:{id,ruc:'2'+BigInt('0x'+id.replaceAll('-','').slice(0,9)).toString().padStart(10,'0').slice(-10),legal_name:'Lectura '+key,sol_user:'local',sol_pass_encrypted:'local'}});if(key==='a')company=id;else other=id;
 }});
 afterAll(async()=>{if(db){await db.company.deleteMany({where:{id:{in:[company,other].filter(Boolean)}}});await db.$disconnect();}});
 it('deniega lectura persistida aunque se mantenga escritura permitida',async()=>{
  await service.replace(company,[{role:'OPERADOR_FACTURACION',moduleCode:'M1',canView:false,canWrite:true}]);
  await expect(service.assertView(company,'OPERADOR_FACTURACION','M1')).rejects.toMatchObject({status:403});
  await expect(service.assertWrite(company,'OPERADOR_FACTURACION','M1')).resolves.toBeUndefined();
 });
 it('el override de una empresa no cambia el default de otra',async()=>{
  await expect(service.assertView(other,'OPERADOR_FACTURACION','M1')).resolves.toBeUndefined();
  await expect(service.assertView(other,'OPERADOR_FACTURACION','M4')).rejects.toMatchObject({status:403});
 });
 it('conserva lectura del auditor y aplica un override explícito de ADMIN',async()=>{
  await expect(service.assertView(company,'AUDITOR','M1')).resolves.toBeUndefined();
  await service.replace(company,[{role:'ADMIN',moduleCode:'M1',canView:false,canWrite:true}]);
  await expect(service.assertView(company,'ADMIN','M1')).rejects.toMatchObject({status:403});
 });
});
