import { BadRequestException, Injectable } from '@nestjs/common';
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

  private defaults(role: string) { return PERMISOS_POR_ROL[role] ?? SIN_ESCRITURA([]); }

  async list(companyId: string) {
    const rows = await this.prisma.roleModulePermission.findMany({ where: { company_id: companyId } });
    const porRol = new Map<string, any>();
    for (const row of rows) porRol.set(`${row.role}:${row.module_code}`, row);
    return ROLES.flatMap((role) => MODULES.map((m) => {
      const row = porRol.get(`${role}:${m.code}`);
      return row ? map(row) : { role, moduleCode: m.code, ...this.roleDefault(role, m.code) };
    }));
  }

  private roleDefault(role: string, code: string) {
    const d = this.defaults(role)[code] ?? { view: false, write: false };
    return { canView: d.view, canWrite: d.write };
  }

  async forRole(companyId: string, role: string) {
    const rows = await this.prisma.roleModulePermission.findMany({ where: { company_id: companyId, role: role as never } });
    const byCode = new Map(rows.map((r) => [r.module_code, map(r)]));
    return MODULES.map((m) => byCode.get(m.code) ?? { role, moduleCode: m.code, ...this.roleDefault(role, m.code) });
  }

  async replace(companyId: string, rows: Array<{ role: string; moduleCode: string; canView: boolean; canWrite: boolean }>) {
    if (!Array.isArray(rows) || rows.some((r) => !ROLES.includes(r.role as never) || !CODES.has(r.moduleCode as never))) {
      throw new BadRequestException('Matriz de permisos inválida.');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.roleModulePermission.upsert({
          where: { company_id_role_module_code: { company_id: companyId, role: row.role as never, module_code: row.moduleCode } },
          create: { company_id: companyId, role: row.role as never, module_code: row.moduleCode, can_view: row.canView, can_write: row.canWrite },
          update: { can_view: row.canView, can_write: row.canWrite },
        });
      }
    });
    return this.list(companyId);
  }
}
