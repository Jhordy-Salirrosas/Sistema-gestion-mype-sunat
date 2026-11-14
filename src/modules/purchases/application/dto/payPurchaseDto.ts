import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AUndefinedSiVacio } from '../../../../common/validators/emptyStringTransform';

export class PayPurchaseDto {
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() paymentDate?: string;
  @IsOptional() @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO']) paymentMethod?: string;
  @IsOptional() @IsString() bankName?: string;
  /**
   * Cuenta de tesorería (`GET /accounting/treasury-accounts`) de la que sale el
   * pago. Si no llega se usa la cuenta de la regla PAGO o la caja principal.
   */
  @AUndefinedSiVacio() @IsOptional() @IsUUID() treasuryAccountId?: string;
}
