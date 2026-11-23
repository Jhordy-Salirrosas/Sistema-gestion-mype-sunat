/**
 * Normaliza el rol que viaja en el token y los roles declarados con `@Roles`.
 *
 * Algunas instalaciones usan el nombre visible "ADMINISTRADOR" en el token
 * aunque el código técnico del rol sea `ADMIN`. Ambos deben ser equivalentes
 * para RBAC, sin distinguir mayúsculas ni espacios accidentales.
 */
export function normalizeRoleCode(
  role: string | null | undefined,
): string {
  const normalized = (role ?? '').trim().toUpperCase();
  return normalized === 'ADMINISTRADOR' ? 'ADMIN' : normalized;
}

export function hasAnyNormalizedRole(
  userRole: string | null | undefined,
  requiredRoles: readonly string[],
): boolean {
  if (requiredRoles.length === 0) return true;
  const current = normalizeRoleCode(userRole);
  return requiredRoles.some((role) => normalizeRoleCode(role) === current);
}
