import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITY_KEY } from '../decorators/capabilityDecorator';
import { ActionPermissionsService } from '../../application/services/actionPermissionsService';
import type { CapabilityCode } from '../../domain/securityCatalog';
@Injectable()
export class CapabilityGuard implements CanActivate {
 constructor(private readonly reflector:Reflector,private readonly permissions:ActionPermissionsService){}
 async canActivate(context:ExecutionContext) {
  const code=this.reflector.getAllAndOverride<CapabilityCode>(CAPABILITY_KEY,[context.getHandler(),context.getClass()]);
  if(!code)return true;
  const user=context.switchToHttp().getRequest().user;
  if(!user?.sub||!user?.companyId||!user?.role)throw new UnauthorizedException('Usuario requerido.');
  await this.permissions.assertAllowed(user.companyId,user.role,code);return true;
 }
}
