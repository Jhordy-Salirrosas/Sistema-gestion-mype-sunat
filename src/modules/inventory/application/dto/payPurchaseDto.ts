import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayPurchaseDto {
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() paymentDate?: string;
  @IsOptional() @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO']) paymentMethod?: string;
  @IsOptional() @IsString() bankName?: string;
}
