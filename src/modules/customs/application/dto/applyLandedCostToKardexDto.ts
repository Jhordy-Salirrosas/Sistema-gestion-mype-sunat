import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyLandedCostToKardexDto {
  @IsNotEmpty({ message: 'El ID del expediente de embarque es obligatorio' })
  @IsString()
  shipment_id: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de movimiento debe tener formato ISO válido' })
  movement_date?: string;
}
