import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString({ message: 'El nombre completo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @MinLength(3, { message: 'El nombre completo debe tener al menos 3 caracteres.' })
  @MaxLength(150, { message: 'El nombre completo no puede exceder los 150 caracteres.' })
  fullName!: string;
}
