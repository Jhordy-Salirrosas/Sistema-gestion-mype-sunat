import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { AUndefinedSiVacio } from '../../../../common/validators/emptyStringTransform';

/** Línea de distribución del importe cobrado entre varias cuentas por cobrar. */
export class CollectionDistributionDto {
  @IsString() accountCode!: string;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsNumber() @Min(0.01) percentage?: number;
}

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
  @AUndefinedSiVacio() @IsOptional() @IsUUID() treasuryAccountId?: string;
  /** Reparto del importe entre varias cuentas por cobrar. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionDistributionDto)
  distributions?: CollectionDistributionDto[];
  @IsNumber() @Min(0.01) amount!: number;
}

export class SetCollectionDistributionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionDistributionDto)
  items!: CollectionDistributionDto[];
}
