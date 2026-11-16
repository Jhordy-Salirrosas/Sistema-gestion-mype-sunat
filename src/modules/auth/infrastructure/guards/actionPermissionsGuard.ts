import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fechaFiscalLima } from '../../../invoices/fiscalDate';
import { ActionPermissionsService } from '../../application/services/actionPermissionsService';
import { ACTION_PERMISSION_KEY, type ActionRequirement } from '../decorators/actionPermissionDecorator';

@Injectable()
export class ActionPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly permissions: ActionPermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<ActionRequirement>(ACTION_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!requirement) return true;
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.companyId || !user?.role) throw new UnauthorizedException('Usuario requerido.');
    if (requirement.differentIssueDateOnly) {
      const fecha = request.body?.fecha_emision;
      // El día fiscal explícito es literal: no se convierte un día civil a UTC.
      // La validación del DTO y la coherencia del payload fiscal se mantienen.
      if (fecha == null || (typeof fecha === 'string' && fecha.slice(0, 10) === fechaFiscalLima())) return true;
    }
    await this.permissions.assertAllowed(user.companyId, user.role, requirement.actionCode);
    return true;
  }
}
