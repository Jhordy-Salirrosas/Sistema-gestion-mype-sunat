import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * Libros que admite el menú SIRE.
 *
 * Se usan los mismos nombres que en el resto del módulo (`RVIE_VENTAS` para
 * ventas y `RCE_COMPRAS` para compras) para que el frontend no tenga que
 * traducir de un endpoint a otro.
 */
export const SIRE_LIBROS_MENU = ['RVIE_VENTAS', 'RCE_COMPRAS'] as const;

export type SireLibroMenu = (typeof SIRE_LIBROS_MENU)[number];

/** Patrón de un periodo válido: AAAAMM con mes real. */
export const SIRE_PERIODO_REGEX = /^(?!0000)\d{4}(0[1-9]|1[0-2])$/;

/**
 * Consulta por periodo del menú SIRE (conciliación y resumen).
 *
 * El periodo es obligatorio: la conciliación y el resumen siempre son de un
 * periodo concreto. El libro es opcional porque la conciliación agrupa por
 * libro.
 */
export class SirePeriodoQueryDto {
  @IsString()
  @Matches(SIRE_PERIODO_REGEX, {
    message: 'El periodo debe tener el formato AAAAMM.',
  })
  periodo!: string;

  @IsOptional()
  @IsIn(SIRE_LIBROS_MENU)
  libro?: SireLibroMenu;
}

/**
 * Cuerpo del envío del libro a SUNAT (`POST /api/v1/sire/reportar`).
 */
export class SireReporteRequestDto {
  @IsString()
  @Matches(SIRE_PERIODO_REGEX, {
    message: 'El periodo debe tener el formato AAAAMM.',
  })
  periodo!: string;

  @IsString()
  @IsIn(SIRE_LIBROS_MENU)
  libro!: SireLibroMenu;
}

/**
 * Cuerpo de la importación de una propuesta (`POST /api/v1/sire/importar`).
 *
 * Periodo y libro son opcionales a propósito: si no llegan, se deducen del
 * nombre del archivo, que es la fuente de verdad. Si tampoco se pueden deducir
 * se devuelve un error explícito.
 */
export class SireImportacionRequestDto {
  @IsOptional()
  @IsString()
  @Matches(SIRE_PERIODO_REGEX, {
    message: 'El periodo debe tener el formato AAAAMM.',
  })
  periodo?: string;

  @IsOptional()
  @IsIn(SIRE_LIBROS_MENU)
  libro?: SireLibroMenu;
}

/**
 * Consulta del historial unificado (`GET /api/v1/sire/historial`).
 */
export class SireHistorialQueryDto {
  @IsOptional()
  @IsString()
  @Matches(SIRE_PERIODO_REGEX, {
    message: 'El periodo debe tener el formato AAAAMM.',
  })
  periodo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;
}
