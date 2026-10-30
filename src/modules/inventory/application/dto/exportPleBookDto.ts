import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExportPleBookDto {
  @IsEnum(['12.1', '13.1'], { message: 'El libro debe ser 12.1 o 13.1' })
  book_type!: '12.1' | '13.1';

  @IsInt()
  @Min(2020)
  @Max(2050)
  fiscal_year!: number;

  @IsString()
  @IsOptional()
  month?: string; // Por defecto "00" (anual)
}

