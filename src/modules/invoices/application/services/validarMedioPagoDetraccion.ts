import { BadRequestException } from '@nestjs/common';
import {
  esMedioPagoDetraccion,
  type MedioPagoDetraccion,
} from '../../domain/rules/medioPagoDetraccion';

/** Ausencia mantiene el XML histórico; null, vacío y números son datos inválidos. */
export function validarMedioPagoDetraccion(
  valor: unknown,
  conDetraccionEfectiva: boolean,
): MedioPagoDetraccion {
  if (valor === undefined) return '999';
  if (!esMedioPagoDetraccion(valor)) {
    throw new BadRequestException(
      'El medio de pago de la detracción debe ser un código del Catálogo 59; ' +
      '1001 es un tipo de operación del Catálogo 51, no un medio de pago.',
    );
  }
  if (!conDetraccionEfectiva) {
    throw new BadRequestException(
      'No se puede informar medio de pago de detracción sin detracción efectiva.',
    );
  }
  return valor;
}

/** Solo para altas nuevas; nunca usar en cola ni regeneración histórica. */
export function validarMedioPagoDetraccionEmision(
  valor: unknown,
  conDetraccionEfectiva: boolean,
): MedioPagoDetraccion {
  if (valor === undefined && conDetraccionEfectiva) {
    throw new BadRequestException(
      'El medio de pago de la detracción (medio_pago_detraccion / medioPagoDetraccion) ' +
      'es obligatorio cuando hay detracción efectiva; indique un código del Catálogo 59.',
    );
  }
  return validarMedioPagoDetraccion(valor, conDetraccionEfectiva);
}
