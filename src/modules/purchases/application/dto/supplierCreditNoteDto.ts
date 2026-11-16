import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplierCreditNoteDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() notes?: string;
}
