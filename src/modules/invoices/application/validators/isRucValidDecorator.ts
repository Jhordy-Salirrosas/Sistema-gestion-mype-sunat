import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { esRucValido } from '../../../../common/validators/ruc';

/**
 * Validación del RUC en DTOs.
 *
 * La aritmética del módulo 11 está en `common/validators/ruc` porque la
 * exportación PLE necesita la misma comprobación fuera de un DTO.
 */
@ValidatorConstraint({ async: false })
export class IsRucValidConstraint implements ValidatorConstraintInterface {
  validate(ruc: unknown, _args: ValidationArguments) {
    return esRucValido(ruc);
  }

  defaultMessage(_args: ValidationArguments) {
    return 'El RUC ingresado no es matemáticamente válido (falla validación SUNAT)';
  }
}

/** Decorador personalizado @IsRucValid(). */
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
