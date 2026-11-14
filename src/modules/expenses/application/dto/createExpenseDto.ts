import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsRucValid } from '../../../invoices/application/validators/isRucValidDecorator';

/**
 * Línea de distribución de la base del gasto.
 *
 * Se envía `amount` **o** `percentage`; la validación de que sumen la base (o
 * el 100%) y de que la cuenta exista en el PCGE se hace en el servicio, porque
 * necesita el importe total y el catálogo.
 */
export class ExpenseDistributionDto {
  @IsString() accountCode!: string;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsNumber() @Min(0.01) percentage?: number;
}

export class CreateExpenseDto {
  @IsString() description!: string;
  @IsString() supplierName!: string;
  @IsOptional() @IsString()
  @ValidateIf((o: { supplierDoc?: string }) => Boolean(o.supplierDoc))
  @IsRucValid({ message: 'El RUC del proveedor no supera la validación módulo 11.' })
  supplierDoc?: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() expenseDate?: string;
  @IsNumber() @Min(0) baseAmount!: number;
  @IsNumber() @Min(0) igvAmount!: number;
  @IsNumber() @Min(0.01) totalAmount!: number;
  /** Reparto de la base entre varias cuentas contables. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseDistributionDto)
  distributions?: ExpenseDistributionDto[];
}

export class SetExpenseDistributionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseDistributionDto)
  items!: ExpenseDistributionDto[];
}
