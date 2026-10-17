import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador @CurrentCompany()
 * Extrae el companyId del token JWT validado por AuthGuard.
 * Blindaje multi-tenant contra ataques de manipulación IDOR.
 */
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.companyId;
  },
);
