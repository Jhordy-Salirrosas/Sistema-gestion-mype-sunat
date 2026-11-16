import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class ReceiveItemDto {
  @IsString() itemId!: string;
  @IsNumber() @Min(0) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) rejectedQuantity?: number;
  @IsOptional() @IsIn(['FALTANTE', 'DANADO', 'NO_CONFORME', 'OTRO']) reason?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReceivePurchaseDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveItemDto)
  items?: ReceiveItemDto[];
  @IsOptional() @IsDateString() receivedAt?: string;
}
