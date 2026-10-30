import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegisterManualMovementDto {
  @IsString()
  @IsOptional()
  warehouse_code?: string; // Por defecto ALM-01

  @IsString()
  @IsNotEmpty({ message: 'El SKU del producto es obligatorio.' })
  sku!: string;

  @IsEnum(['ENTRADA', 'SALIDA'], { message: 'Dirección debe ser ENTRADA o SALIDA.' })
  direction!: 'ENTRADA' | 'SALIDA';

  @IsString()
  @IsNotEmpty({ message: 'El tipo de operación según Tabla 12 SUNAT es obligatorio.' })
  operation_type_code!: string; // 01 Venta, 02 Compra nac, 16 Saldo inicial, 28 Ajuste, etc.

  @IsNumber()
  @Min(0.0001, { message: 'La cantidad debe ser mayor a cero.' })
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'El costo unitario no puede ser negativo.' })
  @IsOptional()
  unit_cost?: number;

  @IsString()
  @IsOptional()
  document_type_code?: string; // 01 Factura, 03 Boleta, etc.

  @IsString()
  @IsOptional()
  document_serial?: string;

  @IsString()
  @IsOptional()
  document_number?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  movement_date?: string;
}

