import { SYSTEM_ROLES } from '../../domain/securityCatalog';
import { companyRoles, customRolesEnabled, requireCompanyRole, requireAssignableRole } from './roleCatalogService';
import { auditSecurityChange } from './securityAudit';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

export const MODULES = [
  { code: 'M1', name: 'Facturación' }, { code: 'M2', name: 'Importaciones' }, { code: 'M3', name: 'SIRE' },
  { code: 'M4', name: 'Contabilidad' }, { code: 'M5', name: 'Resiliencia' }, { code: 'M6', name: 'Inventario y Kardex' },
  { code: 'M7', name: 'Ventas' }, { code: 'M8', name: 'Compras' }, { code: 'M9', name: 'Seguridad y Accesos' },
  { code: 'M10', name: 'Experiencia de Usuario' },
] as const;
export const ROLES = ['ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR'] as const;
const CODES = new Set(MODULES.map((m) => m.code));
const DEFAULTS: Record<string, { view: boolean; write: boolean }> = {};
for (const code of CODES) DEFAULTS[code] = { view: true, write: true };
const SIN_ESCRITURA = (codes: string[]) => Object.fromEntries([...CODES].map((c) => [c, { view: codes.includes(c), write: false }]));
const PERMISOS_POR_ROL: Record<string, Record<string, { view: boolean; write: boolean }>> = {
  ADMIN: DEFAULTS,
  CONTADOR: { ...DEFAULTS, M9: { view: false, write: false } },
  OPERADOR_FACTURACION: { ...SIN_ESCRITURA(['M1', 'M6', 'M7', 'M10']), M1: { view: true, write: true }, M7: { view: true, write: true } },
  OPERADOR_ADUANAS: { ...SIN_ESCRITURA(['M2', 'M6', 'M8']), M2: { view: true, write: true }, M6: { view: true, write: true }, M8: { view: true, write: true } },
  AUDITOR: SIN_ESCRITURA([...CODES]),
};
const map = (p: any) => ({ role: p.role, moduleCode: p.module_code, canView: p.can_view, canWrite: p.can_write });

@Injectable()
export class ModulePermissionsService {
  constructor(private readonly prisma: PrismaService) {}
  private roleDefault(role: string, code: string) {
    const d=(PERMISOS_POR_ROL[role]??SIN_ESCRITURA([]))[code]??{view:false,write:false};
    return {canView:d.view,canWrite:d.write};
  }
  async list(companyId: string) {
    const roles=await companyRoles(this.prisma,companyId);
    const rows=await this.prisma.roleModulePermission.findMany({where:{company_id:companyId}});
    return roles.flatMap(({code:role})=>MODULES.map(m=>{
      const row=rows.find(r=>r.role===role&&r.module_code===m.code);
      return row?map(row):{role,moduleCode:m.code,...this.roleDefault(role,m.code)};
    }));
  }
  async forRole(companyId:string,role:string) {
    await requireCompanyRole(this.prisma,companyId,role);
    const enabled=(SYSTEM_ROLES as readonly string[]).includes(role)||await customRolesEnabled(this.prisma);
    if(!enabled)return MODULES.map(m=>({role,moduleCode:m.code,canView:false,canWrite:false}));
    const rows=await this.prisma.roleModulePermission.findMany({where:{company_id:companyId}});
    return MODULES.map(m=>{const row=rows.find(r=>r.role===role&&r.module_code===m.code);return row?map(row):{role,moduleCode:m.code,...this.roleDefault(role,m.code)};});
  }
  async assertWrite(companyId:string,role:string,moduleCode:string) {
    await requireCompanyRole(this.prisma,companyId,role);
    if(role==='ADMIN')return;
    if(!(await this.forRole(companyId,role)).find(r=>r.moduleCode===moduleCode)?.canWrite)throw new ForbiddenException(`No tiene permiso de escritura en el módulo ${moduleCode}.`);
  }
  async assertView(companyId:string,role:string,moduleCode:string) {
    if(!(await this.forRole(companyId,role)).find(r=>r.moduleCode===moduleCode)?.canView)throw new ForbiddenException(`No tiene permiso de lectura en el módulo ${moduleCode}.`);
  }
  async replace(companyId:string,rows:Array<{role:string;moduleCode:string;canView:boolean;canWrite:boolean}>,actorId:string|null=null) {
    if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.role!=='string'||!CODES.has(r.moduleCode as never)||typeof r.canView!=='boolean'||typeof r.canWrite!=='boolean')||new Set(rows.map(r=>`${r.role}:${r.moduleCode}`)).size!==rows.length)throw new BadRequestException('Matriz de permisos inválida.');
    await this.prisma.$transaction(async tx=>{
      const before=await tx.roleModulePermission.findMany({where:{company_id:companyId}});
      for(const row of rows){
        await requireAssignableRole(tx,companyId,row.role);
        if(row.role==='ADMIN'){
          const previous=before.find(r=>r.role===row.role&&r.module_code===row.moduleCode);
          const effective=previous?map(previous):this.roleDefault(row.role,row.moduleCode);
          if(effective.canView!==row.canView||effective.canWrite!==row.canWrite)throw new ForbiddenException('Los permisos de ADMIN están protegidos.');
          continue;
        }
        await tx.roleModulePermission.upsert({where:{company_id_role_module_code:{company_id:companyId,role:row.role,module_code:row.moduleCode}},create:{company_id:companyId,role:row.role,module_code:row.moduleCode,can_view:row.canView,can_write:row.canWrite},update:{can_view:row.canView,can_write:row.canWrite}});
      }
      await auditSecurityChange(tx,companyId,actorId,'ROLE_MODULE_PERMISSIONS','modules',before,await tx.roleModulePermission.findMany({where:{company_id:companyId}}));
    });return this.list(companyId);
  }
}
