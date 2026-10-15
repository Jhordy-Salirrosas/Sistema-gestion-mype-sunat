import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AccountingLineDto {
  @IsNumber()
  lineOrder: number;

  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsNumber()
  debitAmount: number;

  @IsNumber()
  creditAmount: number;
}

export class CreateAccountingEntryDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  period: string; // YYYY-MM

  @IsNumber()
  @IsOptional()
  entryNumber?: number;

  @IsDateString()
  entryDate: string;

  @IsString()
  @IsNotEmpty()
  glosa: string;

  @IsString()
  @IsNotEmpty()
  sourceModule: string;

  @IsString()
  @IsOptional()
  sourceReferenceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingLineDto)
  lines: AccountingLineDto[];
}
