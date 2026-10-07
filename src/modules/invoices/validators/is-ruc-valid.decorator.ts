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
   * @param args Argumentos adicionales proporcionados por class-validator.
   * @returns `true` si el RUC es matemáticamente válido, `false` si es inválido.
   */
  validate(ruc: any, args: ValidationArguments) {
    // 1. Filtro rápido de formato: Si no es un texto o no tiene exactamente 11 números, es inválido.
    // Esto evita que el sistema gaste CPU calculando RUCs maliciosos o con letras.
    if (typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) {
      return false;
    }

    // 2. Factores de ponderación: Son multiplicadores estáticos definidos por SUNAT.
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    // 3. Fase de Sumatoria: Multiplicar cada uno de los primeros 10 dígitos del RUC 
    // por su factor correspondiente y acumular el resultado.
    for (let i = 0; i < 10; i++) {
      sum += parseInt(ruc.charAt(i), 10) * weights[i];
    }

    // 4. Algoritmo Módulo 11: Se halla el residuo de la suma entre 11 y se le resta a 11.
    let diff = 11 - (sum % 11);

    // 5. Excepciones matemáticas de SUNAT:
    // Si la resta dio 10, el dígito verificador debe ser 0.
    if (diff === 10) diff = 0;
    // Si la resta dio 11, el dígito verificador debe ser 1.
    if (diff === 11) diff = 1;

    // 6. Verificación Final: El dígito matemático obtenido (diff) debe ser EXACTAMENTE 
    // igual al último dígito (el número 11) del RUC que nos mandaron.
    const checkDigit = parseInt(ruc.charAt(10), 10);
    return diff === checkDigit;
  }

  /**
   * Mensaje de error que se arrojará si el método `validate` retorna false.
   */
  defaultMessage(args: ValidationArguments) {
    return 'El RUC ingresado no es matemáticamente válido (falla validación SUNAT)';
  }
}

/**
 * Decorador personalizado @IsRucValid()
 * Este es el "envoltorio" que importaremos y colocaremos encima de los campos 
 * en nuestro archivo CreateInvoiceDto.
 */
export function IsRucValid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRucValidConstraint,
    });
  };
}
