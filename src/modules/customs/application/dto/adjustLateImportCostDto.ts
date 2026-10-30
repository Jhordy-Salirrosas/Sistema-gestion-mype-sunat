import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AdjustLateImportCostDto {
  @IsNotEmpty()
  @IsString()
  shipmentId!: string;

  @IsNotEmpty()
  @IsString()
  supplierRuc!: string;

  @IsNotEmpty()
  @IsString()
  supplierName!: string;

  @IsNotEmpty()
  @IsString()
  expenseConcept!: string; // DEMURRAGE, SOBRESTADIA, ALMACENAJE_TARDIO, AJUSTE_VALOR_OMC

  @IsNotEmpty()
  @IsString()
  invoiceSerialNumber!: string;

  @IsNotEmpty()
  @IsString()
  issueDate!: string;

  @IsNumber()
  @Min(0)
  netAmountPen!: number;

  @IsNumber()
  @Min(0)
  igvAmountPen!: number;

  @IsNumber()
  @Min(0)
  totalAmountPen!: number;

  @IsOptional()
  @IsBoolean()
  isCapitalizable?: boolean;

  @IsOptional()
  @IsEnum(['PESO_BRUTO', 'VALOR_FOB', 'VALOR_CIF'])
  prorationMethod?: 'PESO_BRUTO' | 'VALOR_FOB' | 'VALOR_CIF';

  @IsOptional()
  @IsString()
  adjustmentJustification?: string;
}

