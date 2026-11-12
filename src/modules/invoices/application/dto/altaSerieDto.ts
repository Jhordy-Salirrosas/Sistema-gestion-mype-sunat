import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Entrada de alta/reactivación: los tipos se validan antes de normalizar. */
export class AltaSerieDto {
  @IsString({ message: 'document_type debe ser una cadena' })
  @IsNotEmpty({ message: 'document_type es obligatorio' })
  document_type: string;

  @IsString({ message: 'series debe ser una cadena' })
  @IsNotEmpty({ message: 'series es obligatorio' })
  series: string;

  @IsOptional()
  @IsInt({ message: 'correlativo_inicial debe ser un entero' })
  @Min(0, { message: 'correlativo_inicial debe ser mayor o igual que 0' })
  @Max(99999999, { message: 'correlativo_inicial no puede superar 99999999' })
  correlativo_inicial?: number;
}
