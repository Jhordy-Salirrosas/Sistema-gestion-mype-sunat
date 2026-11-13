import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IsRucValid } from '../../../invoices/application/validators/isRucValidDecorator';

export class CreateManualPayableDto {
  @IsString() supplierName!: string;
  @IsString()
  @IsRucValid({ message: 'El RUC del proveedor no supera la validación módulo 11.' })
  supplierDocNumber!: string;
  @IsString() description!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsNumber() @Min(0.000001) exchangeRate?: number;
  @IsOptional() @IsDateString() issueDate?: string;
}
