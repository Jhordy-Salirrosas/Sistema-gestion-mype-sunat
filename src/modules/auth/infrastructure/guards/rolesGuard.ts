import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/rolesDecorator';
import type { UserRole } from '../../domain/entities/userEntity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Acceso denegado: Usuario no autenticado.');
    }

    const hasRole = requiredRoles.includes(user.role as UserRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: Se requiere uno de los roles [${requiredRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
