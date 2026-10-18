import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class RegisterDuaItemDto {
  @IsInt()
  @Min(1, { message: 'El orden del ítem debe ser mayor o igual a 1' })
  item_order: number;

  @IsOptional()
  @IsString()
  item_code?: string;

  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'La subpartida nacional debe tener exactamente 10 dígitos numéricos',
  })
  hs_code: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción comercial es obligatoria' })
  commercial_description: string;

  @IsNumber()
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  quantity: number;

  @IsString()
  @IsNotEmpty({ message: 'La unidad de medida es obligatoria' })
  unit_code: string;

  @IsNumber()
  @IsPositive({ message: 'El valor FOB unitario debe ser mayor a 0' })
  fob_unit_usd: number;
}

export class RegisterDuaDto {
  @IsString()
  @Matches(/^\d{3}-\d{4}-\d{2}-\d{6}$/, {
    message:
      'El número de DUA/DAM debe cumplir el formato Aduana-Año-Régimen-Número (ej. 118-2026-10-012345)',
  })
  dua_number: string;

  @IsString()
  @Length(3, 3, { message: 'El código de aduana debe tener 3 dígitos' })
  customs_agency_code: string;

  @IsOptional()
  @IsString()
  regime_code?: string;

  @IsDateString({}, { message: 'La fecha de numeración debe tener formato ISO válido' })
  numeration_date: string;

  @IsNumber()
  @IsPositive({ message: 'El valor FOB total debe ser mayor a 0' })
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

  @IsArray()
  @ArrayMinSize(1, { message: 'La declaración debe incluir al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => RegisterDuaItemDto)
  items: RegisterDuaItemDto[];
}
