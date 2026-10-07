import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsSerieValidConstraint implements ValidatorConstraintInterface {

    /**
     * Método principal de validación cruzada.
     * @param serie El valor de la serie ingresada (ej. 'F001', 'B001').
     * @param args Argumentos que incluyen el objeto completo del DTO.
     * @returns `true` si la serie corresponde al tipo de comprobante, `false` en caso contrario.
     */
    validate(serie: any, args: ValidationArguments) {
        // 1. Filtro rápido: La serie debe ser un texto
        if (typeof serie !== 'string') return false;

        // 2. Extraer el objeto completo (el DTO) para leer el otro campo
        const data = args.object as any;
        const tipoComprobante = data.tipo_comprobante;

        // 3. Si no enviaron el tipo de comprobante, rechazamos porque no podemos cruzar la información
        if (!tipoComprobante) return false;

        // 4. Lógica de validación cruzada usando Expresiones Regulares
        if (tipoComprobante === '01') {
            // Factura: Sistema propio (FXXX) o Portal SUNAT (EXXX, típicamente E001)
            return /^[FE][A-Z0-9]{3}$/.test(serie);
        }

        if (tipoComprobante === '03') {
            // Boleta: Sistema propio (BXXX) o Portal SUNAT (EBXX, típicamente EB01)
            return /^B[A-Z0-9]{3}$|^EB[A-Z0-9]{2}$/.test(serie);
        }

        // Si ingresan otro tipo de comprobante que no hemos mapeado, falla por seguridad.
        return false;
    }

    defaultMessage(args: ValidationArguments) {
        const data = args.object as any;
        if (data.tipo_comprobante === '01') {
            return 'Para Facturas (01), la serie debe comenzar con F (sistemas propios) o E (Portal SUNAT) y tener 4 caracteres';
        }
        if (data.tipo_comprobante === '03') {
            return 'Para Boletas (03), la serie debe comenzar con B (sistemas propios) o EB (Portal SUNAT) y tener 4 caracteres';
        }
        return 'La serie ingresada no corresponde con el tipo de comprobante especificado (o el tipo es inválido)';
    }
}

/**
 * Decorador personalizado @IsSerieValid()
 * Aplica la validación cruzada de Serie vs Tipo de Comprobante.
 * Lo colocaremos encima del campo "serie" en el DTO.
 */
export function IsSerieValid(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsSerieValidConstraint,
        });
    };
}
