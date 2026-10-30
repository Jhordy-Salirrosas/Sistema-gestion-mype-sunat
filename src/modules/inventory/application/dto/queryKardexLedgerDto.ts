import { IsOptional, IsString } from 'class-validator';

export class QueryKardexLedgerDto {
  @IsString()
  @IsOptional()
  product_id?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  warehouse_code?: string;

  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}

