import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class EvaluateBookObligationDto {
  @IsInt()
  @Min(2020)
  @Max(2050)
  fiscal_year!: number;

  @IsNumber()
  @Min(0, { message: 'Los ingresos en UIT no pueden ser negativos.' })
  annual_revenue_uit!: number;

  @IsString()
  @IsNotEmpty({ message: 'El régimen tributario es obligatorio (RER, MYPE_TRIBUTARIO, GENERAL).' })
  tax_regime!: string;
}

