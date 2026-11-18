import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { CAPABILITIES, capabilityAllowed, type CapabilityCode } from '../../domain/securityCatalog';
import { companyRoles, customRolesEnabled, requireAssignableRole, requireCompanyRole } from './roleCatalogService';
import { auditSecurityChange } from './securityAudit';
export const ACTIONS=CAPABILITIES;
export type ActionCode=CapabilityCode;
export interface ActionPermissionRow { role:string;actionCode:ActionCode;allowed:boolean }
@Injectable()
export class ActionPermissionsService {
 constructor(private readonly prisma:PrismaService){}
 private effective(role:string,rows:readonly {action_code:string;allowed:boolean}[],enabled:boolean,operational:boolean):ActionPermissionRow[]{
  return ACTIONS.map(action=>({role,actionCode:action.code,allowed:operational?capabilityAllowed(role,action.code,rows.find(r=>r.action_code===action.code)?.allowed,enabled,action.accessGate?rows.find(r=>r.action_code===action.accessGate)?.allowed:undefined):rows.find(r=>r.action_code===action.code)?.allowed??(action.roles as readonly string[]).includes(role)}));
 }
 async forRole(companyId:string,role:string){
  try{await requireCompanyRole(this.prisma,companyId,role);}catch{throw new ForbiddenException('Rol no autorizado.');}
  const rows=await this.prisma.roleActionPermission.findMany({where:{company_id:companyId}});
  const enabled=await customRolesEnabled(this.prisma);
  return this.effective(role,rows.filter(r=>r.role===role),enabled,true).map(row=>{const definition=ACTIONS.find(a=>a.code===row.actionCode)!;const available=definition.accessGate?capabilityAllowed(role,definition.accessGate,rows.find(r=>r.role===role&&r.action_code===definition.accessGate)?.allowed,enabled):row.allowed||(definition.roles as readonly string[]).includes(role);return {...row,available};});
 }
 async list(companyId:string){
  const roles=await companyRoles(this.prisma,companyId);
  const rows=await this.prisma.roleActionPermission.findMany({where:{company_id:companyId}});
  return roles.flatMap(({code})=>this.effective(code,rows.filter(r=>r.role===code),false,false));
 }
 async assertAllowed(companyId:string,role:string,actionCode:ActionCode){
  if(!(await this.forRole(companyId,role)).find(r=>r.actionCode===actionCode)?.allowed)throw new ForbiddenException({code:'ACTION_PERMISSION_DENIED',action:actionCode,message:`No tiene permiso para la acción ${actionCode}.`});
 }
 async replace(companyId:string,input:unknown,actorId:string|null=null){
  if(!Array.isArray(input)||input.some(row=>!row||typeof row!=='object'||typeof row.role!=='string'||!ACTIONS.some(a=>a.code===row.actionCode)||typeof row.allowed!=='boolean')||new Set(input.map(r=>`${r.role}:${r.actionCode}`)).size!==input.length)throw new BadRequestException('Matriz de permisos por acción inválida.');
  const rows=input as ActionPermissionRow[];
  for(const row of rows)await requireAssignableRole(this.prisma,companyId,row.role);
  await this.prisma.$transaction(async tx=>{
   const before=await tx.roleActionPermission.findMany({where:{company_id:companyId}});
   for(const row of rows){
    await requireAssignableRole(tx,companyId,row.role);
    if(row.role==='ADMIN'){
      const value=before.find(r=>r.role===row.role&&r.action_code===row.actionCode)?.allowed??(ACTIONS.find(a=>a.code===row.actionCode)!.roles as readonly string[]).includes(row.role);
      if(value!==row.allowed)throw new ForbiddenException('Los permisos de ADMIN están protegidos.');continue;
    }
    await tx.roleActionPermission.upsert({where:{company_id_role_action_code:{company_id:companyId,role:row.role,action_code:row.actionCode}},create:{company_id:companyId,role:row.role,action_code:row.actionCode,allowed:row.allowed},update:{allowed:row.allowed}});
   }
   await auditSecurityChange(tx,companyId,actorId,'ROLE_ACTION_PERMISSIONS','actions',before,await tx.roleActionPermission.findMany({where:{company_id:companyId}}));
  });return this.list(companyId);
 }
}
