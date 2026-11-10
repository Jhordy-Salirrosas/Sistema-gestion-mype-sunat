import { IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { IsRucValid } from '../../../invoices/application/validators/isRucValidDecorator';

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
}
