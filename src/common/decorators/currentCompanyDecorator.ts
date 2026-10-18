import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador @CurrentCompany()
 * Extrae el companyId del usuario autenticado (inyectado por AuthGuard en request.user)
 * o de la propiedad companyId del request.
 * Cumple con la directiva Anti-IDOR (PLAN.md § 6.3).
 */
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.companyId ?? request.companyId;
  },
);
