import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { Prisma } from '../../../../generated/client/client';
import { SYSTEM_ROLES, SYSTEM_ROLE_NAMES, RESERVED_ROLE_CODES } from '../../domain/securityCatalog';
import { MENU_CATALOG } from '../../domain/menuCatalog';
import { auditSecurityChange } from './securityAudit';

export async function initializeCompanyRoles(tx: Pick<Prisma.TransactionClient, 'companyRole' | 'roleMenuPermission'>, companyId: string) {
  await tx.companyRole.createMany({ data: SYSTEM_ROLES.map(code => ({ company_id: companyId, code, name: SYSTEM_ROLE_NAMES[code]!, is_system: true })), skipDuplicates: true });
  await tx.roleMenuPermission.createMany({ data: SYSTEM_ROLES.flatMap(role => MENU_CATALOG.map(menu => ({ company_id: companyId, role_code: role, menu_code: menu.code, can_view: menu.roles.includes(role) }))), skipDuplicates: true });
}
export async function companyRoles(db: Pick<Prisma.TransactionClient,'companyRole'>, companyId: string) {
  return db.companyRole.findMany({ where: { company_id: companyId }, orderBy: [{ is_system: 'desc' }, { code: 'asc' }] });
}
export async function requireCompanyRole(db: Pick<Prisma.TransactionClient,'companyRole'>, companyId: string, code: string) {
  const role = await db.companyRole.findUnique({ where: { company_id_code: { company_id: companyId, code } } });
  if (!role) throw new BadRequestException('El rol no pertenece a la empresa.');
  return role;
}
/** Doble compuerta: un flag no permite asignar códigos propios a columnas enum. */
export async function customRolesEnabled(db: Pick<Prisma.TransactionClient,'$queryRaw'>): Promise<boolean> {
  if (process.env.ROLES_CUSTOM_ENABLED !== 'true') return false;
  const rows = await db.$queryRaw<Array<{ storage: string; validated: boolean }>>`SELECT format_type(a.atttypid,a.atttypmod) AS storage, EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=a.attrelid AND c.confrelid='public.company_roles'::regclass AND c.contype='f' AND c.convalidated AND cardinality(c.conkey)=2) AS validated FROM pg_attribute a WHERE a.attrelid IN ('public.users'::regclass,'public.role_module_permissions'::regclass,'public.role_action_permissions'::regclass) AND a.attname='role' AND NOT a.attisdropped`;
  return rows.length === 3 && rows.every(row=>row.storage==='text'&&row.validated);
}
export async function requireAssignableRole(db: Pick<Prisma.TransactionClient,'companyRole'|'$queryRaw'>, companyId: string, code: string) {
  const role = await requireCompanyRole(db, companyId, code);
  if (!(SYSTEM_ROLES as readonly string[]).includes(role.code) && !await customRolesEnabled(db)) throw new ForbiddenException('La creación y asignación de roles propios no está habilitada.');
  return role;
}
export const roleDto = (r: { code: string; name: string; is_system: boolean }) => ({ code: r.code, name: r.name, isSystem: r.is_system });

@Injectable()
export class RoleCatalogService {
  constructor(private readonly prisma: PrismaService) {}
  async list(companyId: string) { return (await companyRoles(this.prisma, companyId)).map(roleDto); }
  async config() { return { customRolesEnabled: await customRolesEnabled(this.prisma) }; }
  async rename(companyId: string, code: string, name: string, actorId: string) {
    const clean=name.trim();
    if (!clean || clean.length>100) throw new BadRequestException('El nombre debe tener entre 1 y 100 caracteres.');
    if (code==='ADMIN') throw new ForbiddenException('El código y el nombre de ADMIN están protegidos.');
    return this.prisma.$transaction(async tx => {
      const before=await tx.companyRole.findUnique({ where: { company_id_code: {company_id:companyId,code} } });
      if (!before) throw new NotFoundException('Rol no encontrado en la empresa.');
      const after=await tx.companyRole.update({where:{company_id_code:{company_id:companyId,code}},data:{name:clean}});
      await auditSecurityChange(tx,companyId,actorId,'ROLE_RENAME',code,roleDto(before),roleDto(after));
      return roleDto(after);
    });
  }
  async create(companyId: string, code: string, name: string, actorId: string) {
    if (!await customRolesEnabled(this.prisma)) throw new ForbiddenException('La creación y asignación de roles propios no está habilitada.');
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code) || RESERVED_ROLE_CODES.includes(code)) throw new BadRequestException('Código de rol inválido o reservado.');
    const clean=name.trim(); if(!clean||clean.length>100)throw new BadRequestException('Nombre de rol inválido.');
    try {
      return await this.prisma.$transaction(async tx=>{
        const row=await tx.companyRole.create({data:{company_id:companyId,code,name:clean,is_system:false}});
        await auditSecurityChange(tx,companyId,actorId,'ROLE_CREATE',code,null,roleDto(row));return roleDto(row);
      });
    } catch(e) { if((e as {code?:string})?.code==='P2002')throw new ConflictException('El código del rol ya existe en la empresa.');throw e; }
  }
}
