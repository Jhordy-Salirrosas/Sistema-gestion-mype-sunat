import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsRucValidConstraint implements ValidatorConstraintInterface {
  /**
   * Método principal que ejecuta la validación matemática.
   * @param ruc El valor del RUC ingresado por el usuario en el JSON.
   * @param _args Argumentos adicionales proporcionados por class-validator.
   * @returns `true` si el RUC es matemáticamente válido, `false` si es inválido.
   */
  validate(ruc: any, _args: ValidationArguments) {
    // 1. Validar el formato del RUC.
    if (typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) {
      return false;
    }

    // 2. Factores de ponderación del algoritmo.
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    // 3. Multiplicar los primeros 10 dígitos por sus factores.
    for (let i = 0; i < 10; i++) {
      sum += parseInt(ruc.charAt(i), 10) * weights[i];
    }

    // 4. Calcular el dígito verificador mediante Módulo 11.
    let diff = 11 - (sum % 11);

    // 5. Aplicar las excepciones del cálculo.
    if (diff === 10) diff = 0;
    if (diff === 11) diff = 1;

    // 6. Comparar con el último dígito del RUC.
    const checkDigit = parseInt(ruc.charAt(10), 10);

    return diff === checkDigit;
  }

  /**
   * Mensaje de error cuando el método validate retorna false.
   */
  defaultMessage(_args: ValidationArguments) {
    return 'El RUC ingresado no es matemáticamente válido (falla validación SUNAT)';
  }
}

/**
 * Decorador personalizado @IsRucValid().
 */
export function IsRucValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRucValidConstraint,
    });
  };
}