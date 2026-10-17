import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';

/**
 * Decorador @CurrentUser()
 * Extrae el usuario autenticado desde el request (establecido por AuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
