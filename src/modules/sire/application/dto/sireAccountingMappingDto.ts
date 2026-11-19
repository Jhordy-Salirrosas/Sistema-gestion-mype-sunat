import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Un mapeo entre un concepto SIRE y una cuenta del PCGE.
 *
 * Ejemplos de `tipoOperacion`: `VENTAS`, `COMPRAS`, `IGV`, `BASE`.
 */
export class SireAccountingMappingItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[A-Za-z_]+$/, {
    message:
      'El tipo de operación solo admite letras y guiones bajos (VENTAS, COMPRAS, IGV, BASE...).',
  })
  tipoOperacion!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+$/, {
    message: 'La cuenta contable debe contener solo dígitos (por ejemplo 601).',
  })
  cuentaContable!: string;
}

/**
 * Mapeo contable ya guardado, tal como lo devuelve la API.
 */
export interface SireAccountingMappingResponse {
  tipoOperacion: string;
  cuentaContable: string;
  /** Nombre real de la cuenta en el catálogo PCGE de la base de datos. */
  cuentaNombre?: string | null;
  /** Indica si la cuenta existe y está activa en el catálogo PCGE. */
  cuentaActiva?: boolean;
}
