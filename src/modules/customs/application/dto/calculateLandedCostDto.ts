import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CalculateLandedCostDto {
  @IsNotEmpty({ message: 'El ID del expediente de embarque es obligatorio' })
  @IsString()
  shipment_id: string;

  @IsOptional()
  @IsBoolean()
  approved_by_accountant?: boolean = true;
}
