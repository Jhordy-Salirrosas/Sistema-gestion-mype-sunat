import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { ROLES } from '../services/modulePermissionsService';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateUserDto {
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @Length(3, 150, { message: 'El nombre debe tener entre 3 y 150 caracteres.' })
  name!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;

  @IsIn(ROLES, { message: 'El rol indicado no es válido.' })
  role!: typeof ROLES[number];
}
