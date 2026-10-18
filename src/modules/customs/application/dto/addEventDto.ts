import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddEventDto {
  @IsNotEmpty({ message: 'El tipo de evento es obligatorio (ZARPE, ARRIBO, NUMERACION, CANAL, LEVANTE, RETIRO)' })
  @IsString()
  event_type: string;

  @IsNotEmpty({ message: 'La fecha y hora del evento es obligatoria' })
  event_timestamp: Date;

  @IsOptional()
  @IsString()
  event_value?: string;

  @IsOptional()
  @IsString()
  reference_code?: string;

  @IsNotEmpty({ message: 'El usuario o entidad que registra el evento es obligatorio' })
  @IsString()
  registered_by: string;
}
