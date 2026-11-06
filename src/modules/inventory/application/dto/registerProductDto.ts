import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class RegisterProductDto {
  @IsString()
  @IsNotEmpty({ message: 'El SKU del producto es obligatorio.' })
  sku!: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es obligatoria.' })
  description!: string;

  @IsString()
  @IsOptional()
  sunat_type_code?: string; // 01 Mercaderías por defecto

  @IsString()
  @IsOptional()
  sunat_unit_code?: string; // NIU por defecto

  @IsNumber()
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  @IsOptional()
  min_stock_alert?: number;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  hs_code?: string;

  @IsNumber()
  @IsOptional()
  weight_kg?: number;

  @IsNumber()
  @IsOptional()
  volume_m3?: number;

  @IsString()
  @IsOptional()
  tax_affectation?: string;
}


