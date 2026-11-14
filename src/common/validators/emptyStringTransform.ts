import { Transform } from 'class-transformer';

/**
 * Convierte `''` en `undefined` antes de validar.
 *
 * Los formularios mandan el campo vacío como cadena vacía y `@IsOptional()`
 * solo ignora `null` y `undefined`: sin esto, un campo opcional de tipo UUID
 * enviado como `''` produce un 400 que el usuario no puede explicar (el campo
 * "no lo llenó").
 */
export const AUndefinedSiVacio = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));
