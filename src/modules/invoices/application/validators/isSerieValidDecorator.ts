import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  MENSAJE_SERIE_INVALIDA,
  REGLAS_SERIE,
  serieCorrespondeATipo,
} from '../../domain/rules/serieRules';

@ValidatorConstraint({ async: false })
export class IsSerieValidConstraint implements ValidatorConstraintInterface {
  /**
   * Método principal de validación cruzada.
   * @param serie El valor de la serie ingresada (ej. 'F001', 'B001', 'FC01').
   * @param args Argumentos que incluyen el objeto completo del DTO.
   * @returns `true` si la serie corresponde al tipo de comprobante, `false` en caso contrario.
   */
  validate(serie: unknown, args: ValidationArguments) {
    // 1. Filtro rápido: La serie debe ser un texto
    if (typeof serie !== 'string') return false;

    // 2. Extraer el objeto completo (el DTO) para leer el otro campo
    const data = args.object as Record<string, unknown>;
    const tipoComprobante =
      typeof data?.tipo_comprobante === 'string'
        ? data.tipo_comprobante
        : undefined;

    // 3. Si no enviaron el tipo de comprobante, rechazamos porque no podemos cruzar la información
    if (!tipoComprobante) return false;

    // 4. Validación cruzada delegada a la tabla oficial de series (facturas,
    // boletas y notas de crédito/débito).
    return serieCorrespondeATipo(serie, tipoComprobante);
  }

  defaultMessage(args: ValidationArguments) {
    const data = args.object as Record<string, unknown>;
    const tipo =
      typeof data?.tipo_comprobante === 'string' ? data.tipo_comprobante : '';

    return REGLAS_SERIE[tipo]?.mensaje ?? MENSAJE_SERIE_INVALIDA;
  }
}

/**
 * Decorador personalizado @IsSerieValid()
 * Aplica la validación cruzada de Serie vs Tipo de Comprobante.
 * Lo colocaremos encima del campo "serie" en el DTO.
 */
export function IsSerieValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSerieValidConstraint,
    });
  };
}
