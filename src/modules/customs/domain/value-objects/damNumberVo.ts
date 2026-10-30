import { DuaNumberVO } from './duaNumberVo';

/**
 * Value Object para el número formal de Declaración Aduanera de Mercancías (DAM).
 * Alias normativo para DuaNumberVO según DESPA-PG.01.
 * Formato SUNAT: Aduana (3) - Año (4) - Régimen (2) - Correlativo (6)
 * Ejemplo: 118-2026-10-012345
 */
export class DamNumberVO extends DuaNumberVO {
  constructor(damNumber: string) {
    super(damNumber);
  }
}

