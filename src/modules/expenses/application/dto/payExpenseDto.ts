import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PayExpenseDto {
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() bankName?: string;
  /**
   * Cuenta de tesorería (`GET /accounting/treasury-accounts`) de la que sale el
   * pago. Si no llega se usa la cuenta de la regla PAGO o la caja principal.
   */
  @IsOptional() @IsUUID() treasuryAccountId?: string;
}
