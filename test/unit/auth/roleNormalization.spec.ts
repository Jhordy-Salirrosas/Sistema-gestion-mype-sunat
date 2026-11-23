import {
  hasAnyNormalizedRole,
  normalizeRoleCode,
} from '../../../src/modules/auth/domain/roleNormalization';

describe('roleNormalization', () => {
  it('normaliza ADMINISTRADOR al código técnico ADMIN', () => {
    expect(normalizeRoleCode(' administrador ')).toBe('ADMIN');
    expect(normalizeRoleCode('Admin')).toBe('ADMIN');
    expect(normalizeRoleCode('CONTADOR')).toBe('CONTADOR');
  });

  it('trata roles ausentes o vacíos como cadena vacía', () => {
    expect(normalizeRoleCode(undefined)).toBe('');
    expect(normalizeRoleCode(null)).toBe('');
    expect(normalizeRoleCode('   ')).toBe('');
  });

  it('acepta cualquier alias normalizado de la lista requerida', () => {
    expect(hasAnyNormalizedRole('ADMINISTRADOR', ['ADMIN'])).toBe(true);
    expect(hasAnyNormalizedRole(' admin ', ['ADMINISTRADOR'])).toBe(true);
    expect(hasAnyNormalizedRole(' contador ', ['ADMIN', 'CONTADOR'])).toBe(
      true,
    );
  });

  it('rechaza roles que no están en la lista y permite listas vacías', () => {
    expect(hasAnyNormalizedRole('OPERADOR', ['ADMIN'])).toBe(false);
    expect(hasAnyNormalizedRole(undefined, ['ADMIN'])).toBe(false);
    expect(hasAnyNormalizedRole('OPERADOR', [])).toBe(true);
  });
});
