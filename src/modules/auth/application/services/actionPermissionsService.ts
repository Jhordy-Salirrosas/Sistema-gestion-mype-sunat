import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { ROLES } from './modulePermissionsService';

export const ACTIONS = [
  { code: 'INVOICE_EDIT_ISSUE_DATE', roles: ['ADMIN'] },
  { code: 'INVOICE_FORCE_RESEND', roles: ['ADMIN'] },
  { code: 'INVOICE_RESOLVE_DLQ', roles: ['ADMIN', 'OPERADOR_FACTURACION'] },
  { code: 'INVOICE_REPROCESS_BRIDGE', roles: ['ADMIN'] },
] as const;
export type ActionCode = typeof ACTIONS[number]['code'];
export interface ActionPermissionRow { role: string; actionCode: ActionCode; allowed: boolean }

@Injectable()
export class ActionPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private effective(role: string, rows: readonly { action_code: string; allowed: boolean }[]): ActionPermissionRow[] {
    return ACTIONS.map(action => ({
      role, actionCode: action.code,
      allowed: rows.find(row => row.action_code === action.code)?.allowed
        ?? (action.roles as readonly string[]).includes(role),
    }));
  }

  async forRole(companyId: string, role: string) {
    if (!(ROLES as readonly string[]).includes(role)) throw new ForbiddenException('Rol no autorizado.');
    const rows = await this.prisma.roleActionPermission.findMany({ where: { company_id: companyId, role: role as never } });
    return this.effective(role, rows);
  }

  async list(companyId: string) {
    const rows = await this.prisma.roleActionPermission.findMany({ where: { company_id: companyId } });
    return ROLES.flatMap(role => this.effective(role, rows.filter(row => row.role === role)));
  }

  async assertAllowed(companyId: string, role: string, actionCode: ActionCode) {
    const rows = await this.forRole(companyId, role);
    if (!rows.find(row => row.actionCode === actionCode)?.allowed) {
      throw new ForbiddenException({ code: 'ACTION_PERMISSION_DENIED', action: actionCode, message: `No tiene permiso para la acción ${actionCode}.` });
    }
  }

  async replace(companyId: string, input: unknown) {
    if (!Array.isArray(input) || input.some(row => !row || typeof row !== 'object'
      || !(ROLES as readonly unknown[]).includes(row.role)
      || !ACTIONS.some(action => action.code === row.actionCode) || typeof row.allowed !== 'boolean')
      || new Set(input.map(row => `${row.role}:${row.actionCode}`)).size !== input.length) {
      throw new BadRequestException('Matriz de permisos por acción inválida.');
    }
    const rows = input as ActionPermissionRow[];
    await this.prisma.$transaction(async tx => {
      for (const row of rows) {
        await tx.roleActionPermission.upsert({
          where: { company_id_role_action_code: { company_id: companyId, role: row.role as never, action_code: row.actionCode } },
          create: { company_id: companyId, role: row.role as never, action_code: row.actionCode, allowed: row.allowed },
          update: { allowed: row.allowed },
        });
      }
    });
    return this.list(companyId);
  }
}
