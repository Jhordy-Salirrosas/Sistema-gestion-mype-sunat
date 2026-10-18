import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class AddLocalExpenseDto {
  @IsNotEmpty({ message: 'El ID del expediente de embarque es obligatorio' })
  @IsString()
  shipment_id: string;

  @IsNotEmpty({ message: 'El RUC del proveedor local es obligatorio' })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'El RUC del proveedor debe tener exactamente 11 dígitos' })
  supplier_ruc: string;

  @IsNotEmpty({ message: 'La razón social del proveedor es obligatoria' })
  @IsString()
  supplier_name: string;

  @IsNotEmpty({ message: 'El concepto del gasto es obligatorio (ej. ALMACENAJE, AGENCIA, TRANSPORTE_LOCAL)' })
  @IsString()
  expense_concept: string;

  @IsNotEmpty({ message: 'La serie y número del comprobante es obligatorio (ej. F001-00012345)' })
  @IsString()
  invoice_serial_number: string;

  @IsNotEmpty({ message: 'La fecha de emisión del comprobante es obligatoria' })
  @IsDateString({}, { message: 'La fecha de emisión debe tener formato ISO válido' })
  issue_date: string;

  @IsNumber()
  @IsPositive({ message: 'El valor neto (base imponible) debe ser mayor a 0' })
  net_amount_pen: number;

  @IsNumber()
  @Min(0, { message: 'El monto de IGV no puede ser negativo' })
  igv_amount_pen: number;

  @IsNumber()
  @IsPositive({ message: 'El total de la factura debe ser mayor a 0' })
  total_amount_pen: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La tasa de detracción SPOT no puede ser negativa' })
  spot_detraction_rate?: number = 0.0;

  @IsOptional()
  @IsBoolean()
  is_capitalizable?: boolean = true;

  @IsOptional()
  @IsString()
  proration_method?: string = 'VALOR_FOB'; // VALOR_FOB, PESO_BRUTO, UNIDADES
}
