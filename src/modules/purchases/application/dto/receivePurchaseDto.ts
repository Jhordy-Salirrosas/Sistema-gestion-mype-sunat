import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class ReceiveItemDto {
  @IsString() itemId!: string;
  @IsNumber() @Min(0.0001) quantity!: number;
}

export class ReceivePurchaseDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items?: ReceiveItemDto[];

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
