import { UnauthorizedException } from '@nestjs/common';
import type { TokenPayload } from '../../auth/domain/ports/tokenServicePort';

/** Solo ADMIN administra credenciales y mapeo contable SIRE. */
export const SIRE_CONFIG_ROLES = ['ADMIN'] as const;

/**
 * Roles operativos del SIRE.
 *
 * `OPERADOR_FACTURACION` es el código real del rol en la base de datos;
 * `FACTURADOR` se mantiene como alias para instalaciones que lo usan.
 */
export const SIRE_OPERATION_ROLES = [
  'ADMIN',
  'CONTADOR',
  'FACTURADOR',
  'OPERADOR_FACTURACION',
] as const;

/**
 * Empresa sobre la que opera la petición.
 *
 * Multi-RUC: un ADMIN puede indicar otra empresa; cualquier otro rol queda
 * SIEMPRE acotado a la empresa de su token, aunque envíe un `companyId`.
 */
export function resolveSireCompanyId(
  user: TokenPayload | undefined,
  requestedCompanyId?: string | null,
): string {
  if (!user?.companyId) {
    throw new UnauthorizedException(
      'La empresa del usuario no está definida.',
    );
  }

  const requested = requestedCompanyId?.trim();
  if (user.role === 'ADMIN' && requested) {
    return requested;
  }

  return user.companyId;
}
