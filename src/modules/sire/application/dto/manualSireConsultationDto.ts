import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ManualSireConsultationDto {
  @IsString()
  @Matches(/^\d{11}$/)
  ruc!: string;

  @IsString()
  @Matches(/^(?!0000)\d{4}(0[1-9]|1[0-2])$/)
  period!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  solPassword!: string;
}
