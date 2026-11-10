import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCollectionDto {
  @IsString() customerName!: string;
  @IsOptional() @IsString() customerDoc?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() collectionDate?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsNumber() @Min(0.01) amount!: number;
}
