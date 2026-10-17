import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'El RUC debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El RUC de la empresa es obligatorio.' })
  @Length(11, 11, { message: 'El RUC debe tener exactamente 11 dígitos.' })
  ruc!: string;

  @IsString({ message: 'La razón social debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La razón social es obligatoria.' })
  @MaxLength(200, { message: 'La razón social no puede exceder los 200 caracteres.' })
  legalName!: string;

  @IsString({ message: 'El nombre comercial debe ser una cadena de texto.' })
  @IsOptional()
  @MaxLength(200, { message: 'El nombre comercial no puede exceder los 200 caracteres.' })
  tradeName?: string;

  @IsString({ message: 'El usuario SOL debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El usuario SOL es obligatorio.' })
  @MaxLength(50, { message: 'El usuario SOL no puede exceder los 50 caracteres.' })
  solUser!: string;

  @IsString({ message: 'La clave SOL debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La clave SOL es obligatoria.' })
  solPassword!: string;

  @IsString({ message: 'El nombre completo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre completo del administrador es obligatorio.' })
  @MinLength(3, { message: 'El nombre completo debe tener al menos 3 caracteres.' })
  @MaxLength(150, { message: 'El nombre completo no puede exceder los 150 caracteres.' })
  fullName!: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener un mínimo de 8 caracteres.' })
  password!: string;
}
