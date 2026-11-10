import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString() description!: string;
  @IsString() supplierName!: string;
  @IsOptional() @IsString() supplierDoc?: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() expenseDate?: string;
  @IsNumber() @Min(0) baseAmount!: number;
  @IsNumber() @Min(0) igvAmount!: number;
  @IsNumber() @Min(0.01) totalAmount!: number;
}
