import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateShipmentDto {
  @IsNotEmpty({ message: 'El número de expediente es obligatorio (ej. EXP-2026-0001)' })
  @IsString()
  @Matches(/^EXP-\d{4}-\d{4,6}$/, {
    message: 'El número de expediente debe cumplir el formato EXP-YYYY-NNNNN',
  })
  shipment_number: string;

  @IsOptional()
  @IsString()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  customs_broker_id?: string;

  @IsOptional()
  @IsString()
  incoterm?: string = 'FOB';

  @IsOptional()
  @IsString()
  currency_code?: string = 'USD';

  @IsOptional()
  @IsString()
  transport_mode?: string = 'MARITIMO';

  @IsOptional()
  @IsString()
  origin_country_code?: string = 'CN';

  @IsOptional()
  @IsString()
  destination_customs?: string = '118';

  @IsOptional()
  etd_date?: Date;

  @IsOptional()
  eta_date?: Date;

  @IsOptional()
  @IsString()
  order_reference?: string;
}
