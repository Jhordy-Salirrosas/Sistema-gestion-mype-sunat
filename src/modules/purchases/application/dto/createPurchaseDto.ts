import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseItemDto {
  @IsString()
  @IsNotEmpty({ message: 'El SKU es obligatorio.' })
  sku!: string;

  @IsNumber()
  @Min(0.0001, { message: 'La cantidad debe ser mayor a 0.' })
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'El costo unitario neto no puede ser negativo.' })
  unitCost!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de documento del proveedor (RUC) es obligatorio.' })
  supplierDocNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'La razón social del proveedor es obligatoria.' })
  supplierName!: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsNotEmpty({ message: 'El tipo de comprobante es obligatorio (01 Factura, 03 Boleta).' })
  documentTypeCode!: string; // 01 Factura, 03 Boleta

  @IsString()
  @IsNotEmpty({ message: 'La serie del comprobante es obligatoria (ej: F001).' })
  documentSerial!: string;

  @IsString()
  @IsNotEmpty({ message: 'El número del comprobante es obligatorio (ej: 0001234).' })
  documentNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'La fecha de emisión es obligatoria.' })
  issueDate!: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string; // Default: ALM-01

  @IsString()
  @IsOptional()
  currencyCode?: string; // Default: PEN

  @IsString()
  @IsOptional()
  responsible?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  shipmentId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La compra debe incluir al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}

