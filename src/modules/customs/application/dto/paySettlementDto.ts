import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PaySettlementDto {
  @IsOptional()
  @IsString()
  settlement_id?: string;

  @IsNotEmpty({ message: 'El código de banco es obligatorio (ej. 002 BCP, 011 BBVA, 018 BN)' })
  @IsString()
  bank_code: string;

  @IsNotEmpty({ message: 'El número de operación bancaria es obligatorio' })
  @IsString()
  bank_operation_number: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de pago debe tener formato ISO válido' })
  paid_at?: string;

  @IsOptional()
  @IsString()
  voucher_storage_url?: string;
}
