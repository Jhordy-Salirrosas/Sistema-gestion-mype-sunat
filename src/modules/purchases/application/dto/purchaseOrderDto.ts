import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsString() @IsNotEmpty() sku!: string;
  @IsNumber() @Min(0.0001) quantity!: number;
  @IsNumber() @Min(0) unitCost!: number;
  @IsOptional() @IsString() description?: string;
}

export class CreatePurchaseOrderDto {
  @IsString() @IsNotEmpty() supplierDocNumber!: string;
  @IsString() @IsNotEmpty() supplierName!: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsBoolean() pricesIncludeIgv?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class ConvertPurchaseOrderDto {
  @IsString() @IsNotEmpty() documentTypeCode!: string;
  @IsString() @IsNotEmpty() documentSerial!: string;
  @IsString() @IsNotEmpty() documentNumber!: string;
  @IsOptional() @IsDateString() issueDate?: string;
}
