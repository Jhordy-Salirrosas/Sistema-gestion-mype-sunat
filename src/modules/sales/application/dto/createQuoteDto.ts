import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export const QUOTE_KINDS = ['COTIZACION', 'PEDIDO'] as const;
export const QUOTE_STATUSES = ['BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'CONVERTIDA', 'ANULADA'] as const;

export class QuoteItemDto {
  @IsOptional() @IsString() sku?: string;
  @IsString() description!: string;
  @IsOptional() @IsString() unitCode?: string;
  @IsNumber() @Min(0.0001) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}
export class CreateQuoteDto {
  @IsOptional() @IsIn(QUOTE_KINDS as unknown as string[]) kind?: typeof QUOTE_KINDS[number];
  @IsOptional() @IsString() customerDocType?: string;
  @IsOptional() @IsString() customerDocNumber?: string;
  @IsString() customerName!: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items!: QuoteItemDto[];
}
export class UpdateQuoteStatusDto {
  @IsIn(QUOTE_STATUSES as unknown as string[]) status!: typeof QUOTE_STATUSES[number];
}
