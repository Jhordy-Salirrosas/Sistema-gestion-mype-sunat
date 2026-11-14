import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCollectionDto {
  @IsString() customerName!: string;
  @IsOptional() @IsString() customerDoc?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() collectionDate?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() bankName?: string;
  /**
   * Cuenta de tesorería (`GET /accounting/treasury-accounts`) que recibe el
   * cobro. Si no llega, se usa la cuenta de las reglas COBRO o, en efectivo,
   * la caja principal.
   */
  @IsOptional() @IsUUID() treasuryAccountId?: string;
  @IsNumber() @Min(0.01) amount!: number;
}
