/**
 * Regla de Dominio: Fortaleza de Contraseña.
 * Exige longitud mínima de 8 caracteres, mayúscula, minúscula, dígito y caracter especial.
 */
export class PasswordStrengthRule {
  public static validate(password: string): void {
    if (!password || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('La contraseña debe contener al menos una letra mayúscula.');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('La contraseña debe contener al menos una letra minúscula.');
    }

    if (!/\d/.test(password)) {
      throw new Error('La contraseña debe contener al menos un número.');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      throw new Error('La contraseña debe contener al menos un carácter especial.');
    }
  }
}
