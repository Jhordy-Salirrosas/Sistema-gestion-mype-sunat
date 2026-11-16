import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MENU_CATALOG } from '../../domain/menuCatalog';
import { SYSTEM_ROLES } from '../../domain/securityCatalog';
import { companyRoles, customRolesEnabled, requireAssignableRole, requireCompanyRole } from './roleCatalogService';
import { auditSecurityChange } from './securityAudit';
export interface MenuPermissionRow { role:string;menuCode:string;canView:boolean }
@Injectable()
export class MenuPermissionsService {
 constructor(private readonly prisma:PrismaService){}
 async list(companyId:string){
  const roles=await companyRoles(this.prisma,companyId);
  const rows=await this.prisma.roleMenuPermission.findMany({where:{company_id:companyId}});
  return roles.flatMap(({code:role})=>MENU_CATALOG.map(menu=>({role,menuCode:menu.code,canView:rows.find(r=>r.role_code===role&&r.menu_code===menu.code)?.can_view??menu.roles.includes(role)})));
 }
 async forRole(companyId:string,role:string,modules:readonly {moduleCode:string;canView:boolean}[]){
  await requireCompanyRole(this.prisma,companyId,role);
  const enabled=(SYSTEM_ROLES as readonly string[]).includes(role)||await customRolesEnabled(this.prisma);
  const rows=await this.prisma.roleMenuPermission.findMany({where:{company_id:companyId,role_code:role}});
  const visible=new Map(MENU_CATALOG.map(menu=>[menu.code,enabled&&(!menu.reservedAdmin||role==='ADMIN')&&(rows.find(r=>r.menu_code===menu.code)?.can_view??menu.roles.includes(role))&&Boolean(modules.find(m=>m.moduleCode===menu.moduleCode)?.canView)]));
  const ancestors=(code:string,seen=new Set<string>()):boolean=>{
   if(seen.has(code))return false;seen.add(code);const menu=MENU_CATALOG.find(m=>m.code===code);return Boolean(menu&&visible.get(code)&&(!menu.parentCode||ancestors(menu.parentCode,seen)));
  };
  return MENU_CATALOG.map(menu=>({code:menu.code,moduleCode:menu.moduleCode,path:menu.path,parentCode:menu.parentCode,reservedAdmin:menu.reservedAdmin,canView:ancestors(menu.code)}));
 }
 async replace(companyId:string,input:unknown,actorId:string){
  if(!Array.isArray(input)||input.some(r=>!r||typeof r.role!=='string'||typeof r.canView!=='boolean'||!MENU_CATALOG.some(m=>m.code===r.menuCode))||new Set(input.map(r=>`${r.role}:${r.menuCode}`)).size!==input.length)throw new BadRequestException('Matriz de menús inválida.');
  const rows=input as MenuPermissionRow[];
  await this.prisma.$transaction(async tx=>{
   const before=await tx.roleMenuPermission.findMany({where:{company_id:companyId}});
   for(const row of rows){
    await requireAssignableRole(tx,companyId,row.role);
    if(row.role==='ADMIN'){
     const value=before.find(r=>r.role_code===row.role&&r.menu_code===row.menuCode)?.can_view??true;
     if(value!==row.canView)throw new ForbiddenException('Los permisos de ADMIN están protegidos.');continue;
    }
    const definition=MENU_CATALOG.find(m=>m.code===row.menuCode)!;
    if(definition.reservedAdmin&&row.canView)throw new ForbiddenException('El menú de administración de seguridad está reservado a ADMIN.');
    await tx.roleMenuPermission.upsert({where:{company_id_role_code_menu_code:{company_id:companyId,role_code:row.role,menu_code:row.menuCode}},create:{company_id:companyId,role_code:row.role,menu_code:row.menuCode,can_view:row.canView},update:{can_view:row.canView}});
   }
   await auditSecurityChange(tx,companyId,actorId,'ROLE_MENU_PERMISSIONS','menus',before,await tx.roleMenuPermission.findMany({where:{company_id:companyId}}));
  });return this.list(companyId);
 }
}
