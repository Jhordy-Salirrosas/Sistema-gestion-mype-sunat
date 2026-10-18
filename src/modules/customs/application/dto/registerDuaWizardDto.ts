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

export class RegisterDuaWizardItemDto {
  @IsInt()
  @Min(1, { message: 'El orden del ítem debe ser mayor o igual a 1' })
  item_order: number;

  @IsOptional()
  @IsInt()
  series_order?: number;

  @IsOptional()
  @IsString()
  product_code?: string;

  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'La subpartida nacional (SPN) debe tener exactamente 10 dígitos numéricos',
  })
  hs_code: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción comercial es obligatoria' })
  commercial_description: string;

  @IsOptional()
  @IsString()
  goods_state?: string = 'NUEVO';

  @IsNumber()
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  quantity: number;

  @IsOptional()
  @IsString()
  unit_code?: string = 'NIU';

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El peso neto no puede ser negativo' })
  net_weight_kg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El peso bruto no puede ser negativo' })
  gross_weight_kg?: number;

  @IsNumber()
  @IsPositive({ message: 'El valor FOB unitario debe ser mayor a 0' })
  fob_unit_usd: number;
}

export class RegisterDuaWizardDto {
  @IsOptional()
  @IsString()
  shipment_id?: string;

  @IsString()
  @Matches(/^\d{3}-\d{4}-\d{2}-\d{6}$/, {
    message: 'El formato de DAM/DUA debe ser [Aduana]-[Año]-[Régimen]-[Correlativo 6D] (ej. 118-2026-10-012345)',
  })
  dua_number: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'El código de aduana debe tener 3 dígitos' })
  customs_agency_code?: string = '118';

  @IsOptional()
  @IsString()
  regime_code?: string = '10';

  @IsOptional()
  @IsString()
  dispatch_mode?: string = '10'; // 10 Anticipado, 00 Diferido, 20 Urgente

  @IsDateString({}, { message: 'La fecha de numeración debe tener formato ISO válido' })
  numeration_date: string;

  @IsNumber()
  @IsPositive({ message: 'El valor FOB total debe ser mayor a 0' })
  fob_value_usd: number;

  @IsNumber()
  @Min(0, { message: 'El flete no puede ser negativo' })
  freight_value_usd: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El seguro no puede ser negativo' })
  insurance_value_usd?: number;

  @IsNumber()
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0' })
  exchange_rate: number;

  @IsNumber()
  @Min(0, { message: 'La tasa Ad-Valorem no puede ser negativa' })
  ad_valorem_rate: number;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'La tasa de percepción debe ser mayor a 0' })
  perception_rate?: number = 3.5;

  @IsOptional()
  @IsString()
  transport_doc_number?: string;

  @IsOptional()
  @IsString()
  manifest_number?: string;

  @IsOptional()
  @IsString()
  channel?: string = 'PENDIENTE';

  @IsArray()
  @ArrayMinSize(1, { message: 'La declaración debe incluir al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => RegisterDuaWizardItemDto)
  items: RegisterDuaWizardItemDto[];
}
