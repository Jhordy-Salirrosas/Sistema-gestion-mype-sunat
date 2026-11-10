import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductSupplierDto {
  @IsString()
  @IsNotEmpty()
  supplier_id!: string;

  @IsString()
  @IsOptional()
  supplier_product_code?: string;

  @IsNumber()
  @IsOptional()
  purchase_cost?: number;

  @IsString()
  @IsOptional()
  currency_code?: string;

  @IsNumber()
  @IsOptional()
  lead_time_days?: number;

  @IsBoolean()
  @IsOptional()
  is_preferred?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProductVariantDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de la variante es obligatorio.' })
  variant_name!: string; // ej: "Blanco / 1/2 pulgada"

  @IsOptional()
  attribute_values?: Record<string, string>; // ej: { "Color": "Blanco", "Medida": "1/2 pulgada" }

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  additional_cost?: number;

  @IsNumber()
  @IsOptional()
  price_override?: number;

  @IsNumber()
  @IsOptional()
  current_stock?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class ProductPresentationDto {
  @IsString()
  @IsNotEmpty()
  presentation_name!: string; // ej. "Caja x 50", "Caja x 100", "Fardo x 24"

  @IsNumber()
  @Min(0.0001, { message: 'El factor de conversión debe ser mayor a 0.' })
  factor!: number;

  @IsString()
  @IsOptional()
  sunat_unit_code?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  sale_price?: number;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}

export class RegisterProductDto {
  @IsString()
  @IsNotEmpty({ message: 'El SKU del producto es obligatorio.' })
  sku!: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es obligatoria.' })
  description!: string;

  @IsString()
  @IsOptional()
  origin_type?: string; // NACIONAL | IMPORTADO

  @IsBoolean()
  @IsOptional()
  is_service?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  sunat_type_code?: string; // 01 Mercaderías por defecto (Tabla 5)

  @IsString()
  @IsOptional()
  sunat_unit_code?: string; // NIU por defecto (Tabla 6)

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
  manufacturer?: string;

  @IsString()
  @IsOptional()
  country_of_origin?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

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

  // Precios y reglas de venta (Obs 11, 13)
  @IsNumber()
  @IsOptional()
  cost_price?: number;

  @IsNumber()
  @IsOptional()
  sale_price?: number;

  @IsNumber()
  @IsOptional()
  wholesale_price?: number;

  @IsNumber()
  @IsOptional()
  promo_price?: number;

  @IsNumber()
  @IsOptional()
  commission_rate?: number;

  @IsNumber()
  @IsOptional()
  min_price?: number;

  // Ubicación física (Obs 12)
  @IsString()
  @IsOptional()
  warehouse_location?: string;

  // Proveedores asociados (Obs 6, 12)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSupplierDto)
  @IsOptional()
  suppliers?: ProductSupplierDto[];

  // Variantes y Presentaciones (Obs 10, 25)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributes?: string[]; // ej: ["Color", "Medida", "Acabado"]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPresentationDto)
  @IsOptional()
  presentations?: ProductPresentationDto[];
}
