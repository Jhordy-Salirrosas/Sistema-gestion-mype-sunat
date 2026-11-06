import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TransferItemDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreateTransferDto {
  @IsOptional()
  @IsString()
  transferNumber?: string;

  @IsString()
  @IsNotEmpty()
  fromWarehouseCode!: string;

  @IsString()
  @IsNotEmpty()
  toWarehouseCode!: string;

  @IsOptional()
  @IsString()
  transferDate?: string;

  @IsOptional()
  @IsString()
  responsible?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];
}

export class AdjustmentItemDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class CreateAdjustmentDto {
  @IsOptional()
  @IsString()
  adjustmentNumber?: string;

  @IsString()
  @IsNotEmpty()
  warehouseCode!: string;

  @IsIn(['ENTRADA', 'SALIDA'])
  type!: 'ENTRADA' | 'SALIDA';

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  adjustmentDate?: string;

  @IsOptional()
  @IsString()
  responsible?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentItemDto)
  items!: AdjustmentItemDto[];
}
