import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Credenciales de acceso.
 *
 * No se aplica aquí la política de contraseñas (longitud, complejidad): esa
 * regla pertenece al registro y al cambio de contraseña. En el login solo se
 * exige que haya algo que comparar. Aplicarla aquí rechazaría credenciales
 * antiguas por su longitud antes de verificar el hash, y además filtraría la
 * política del sistema a quien no ha iniciado sesión.
 */
export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;
}
