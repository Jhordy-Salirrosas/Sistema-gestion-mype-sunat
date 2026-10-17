import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
  currentPassword!: string;

  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener un mínimo de 8 caracteres.' })
  newPassword!: string;

  @IsString({ message: 'La confirmación de la contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La confirmación de la nueva contraseña es obligatoria.' })
  confirmPassword!: string;
}
