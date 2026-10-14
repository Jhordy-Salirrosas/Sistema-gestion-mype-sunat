import { IsNumber, IsPositive, Min } from 'class-validator';

export class CalculateDuaDto {
  @IsNumber()
  @IsPositive({ message: 'El valor FOB debe ser mayor a 0' })
  fob_value_usd: number;

  @IsNumber()
  @Min(0, { message: 'El flete no puede ser negativo' })
  freight_value_usd: number;

  @IsNumber()
  @Min(0, { message: 'El seguro no puede ser negativo' })
  insurance_value_usd: number;

  @IsNumber()
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0' })
  exchange_rate: number;

  @IsNumber()
  @Min(0, { message: 'La tasa Ad-Valorem no puede ser negativa' })
  ad_valorem_rate: number;

  @IsNumber()
  @IsPositive({ message: 'La tasa de percepción debe ser mayor a 0' })
  perception_rate: number;
}
