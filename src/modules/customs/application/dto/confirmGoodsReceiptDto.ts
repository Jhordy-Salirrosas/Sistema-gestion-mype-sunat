import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmGoodsReceiptItemDto {
  @IsOptional()
  @IsString()
  customsItemId?: string;

  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @IsNotEmpty()
  @IsString()
  commercialDescription!: string;

  @IsNumber()
  @Min(0)
  declaredQuantity!: number;

  @IsNumber()
  @Min(0)
  receivedQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  damagedQuantity?: number;

  @IsOptional()
  @IsString()
  discrepancyReason?: string; // FALTANTE_ORIGEN, MERMA_TRANSPORTE, SOBRANTE, DANO_EMBALAJE

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsEnum(['MERCADERIA', 'ACTIVO_FIJO'])
  destinationType?: 'MERCADERIA' | 'ACTIVO_FIJO';
}

export class ConfirmGoodsReceiptDto {
  @IsNotEmpty()
  @IsString()
  receiptNumber!: string;

  @IsNotEmpty()
  @IsString()
  declarationId!: string;

  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsNotEmpty()
  @IsString()
  responsibleName!: string;

  @IsOptional()
  @IsString()
  responsibleDni?: string;

  @IsOptional()
  @IsString()
  containerNumber?: string;

  @IsOptional()
  @IsString()
  sealNumber?: string;

  @IsOptional()
  @IsEnum(['TOTAL', 'PARCIAL'])
  receptionType?: 'TOTAL' | 'PARCIAL';

  @IsOptional()
  @IsString()
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmGoodsReceiptItemDto)
  items!: ConfirmGoodsReceiptItemDto[];
}

