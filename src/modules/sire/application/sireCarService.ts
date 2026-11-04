/**
 * Código de Autorización de Recaudación (CAR) para el SIRE RVIE (TA-69).
 *
 * Cuando una boleta anotada en el Registro de Ventas se cobra con una entidad
 * recaudadora (agencia de aduanas, banco, cobrador autorizado), SUNAT no pide el
 * RUC del cliente sino un **CAR**: un código de **27 dígitos** que identifica
 * el depósito. El registro de ventas (PLE 14.1 / RVIE) espera el CAR en la
 * columna 27 cuando el comprobante se cobró por esa vía.
 *
 * Anatomía del CAR:
 *
 *   1 dígito   → tipo de moneda (1 = soles, 2 = dólares)
 *   2 dígitos  → SUNAT reserva este par; la única combinación válida es 00
 *   1 dígito   → tipo de operación (por ahora solo 1)
 *   3 dígitos  → RUC de la entidad recaudadora, sin su dígito verificador ni el
 *                prefijo de tipo; se toma la parte numérica de 3 dígitos
 *   19 dígitos → el número de operación, con ceros a la izquierda
 *
 * Lo que este módulo NO hace: adivinar. Si los datos no alcanzan para armar los
 * 27 dígitos, lanza en lugar de rellenar con ceros un campo que el usuario no
 * informó. Un CAR inventado es peor que un CAR ausente: el registro se acepta y
 * queda un depósito atribuido a otra operación.
 */
import { BadRequestException } from '@nestjs/common';

/** Longitud exacta del CAR. */
export const LONGITUD_CAR = 27;

/** Tipos de moneda admitidos en el CAR: 1 soles, 2 dólares. */
export const MONEDA_CAR: Record<string, string> = {
  PEN: '1',
  USD: '2',
};

/** Único valor válido del par reservado por SUNAT. */
export const PAR_RESERVADO = '00';

/** Datos necesarios para construir el CAR. */
export interface DatosCar {
  /** Moneda del comprobante: PEN o USD. */
  moneda: string;
  /** RUC de la entidad recaudadora (11 dígitos). */
  rucRecaudador: string;
  /** Número de operación / depósito, alfanumérico en origen. */
  numeroOperacion: string;
  /** Tipo de operación; por ahora la única válida es 1. */
  tipoOperacion?: string;
}

/** Valida que una cadena tenga exactamente 27 dígitos numéricos. */
export const esCarValido = (car: string): boolean =>
  new RegExp(`^\\d{${LONGITUD_CAR}}$`).test(car ?? '');

/**
 * Parte numérica del RUC del recaudador.
 *
 * El CAR toma 3 dígitos: la parte secuencial del RUC, sin los dos dígitos del
 * prefijo de tipo (10, 15, 17, 20) y sin el dígito verificador final.
 *
 * BUG corregido: el código de error se escribía `CAR_RECAudADOR_INVALIDO` —una
 * mezcla de mayúsculas que el front no podría comparar.
 */
export const rucRecaudadorCar = (ruc: string): string => {
  const limpio = (ruc ?? '').replace(/\D/g, '');
  if (limpio.length !== 11) {
    throw new BadRequestException({
      code: 'CAR_RECAUDADOR_INVALIDO',
      message: `El RUC del recaudador debe tener 11 dígitos y llegó "${ruc}".`,
    });
  }
  return limpio.slice(2, 5);
};

/**
 * Construye el CAR de 27 dígitos.
 *
 * @throws BadRequestException si falta un dato, si la moneda no está en el
 *   catálogo o si el número de operación no cabe en 19 dígitos.
 */
export const construirCar = (datos: DatosCar): string => {
  const moneda = MONEDA_CAR[(datos.moneda ?? '').toUpperCase()];
  if (!moneda) {
    throw new BadRequestException({
      code: 'CAR_MONEDA_INVALIDA',
      message:
        `La moneda "${datos.moneda}" no admite CAR: solo soles (PEN) y ` +
        'dólares (USD) se cobran por entidad recaudadora.',
    });
  }

  const tipoOperacion = datos.tipoOperacion ?? '1';
  if (tipoOperacion !== '1') {
    throw new BadRequestException({
      code: 'CAR_TIPO_OPERACION_INVALIDO',
      message: `El tipo de operación "${tipoOperacion}" no está soportado: solo el 1.`,
    });
  }

  const recaudador = rucRecaudadorCar(datos.rucRecaudador);

  const operacion = (datos.numeroOperacion ?? '').replace(/\D/g, '');
  if (operacion.length === 0) {
    throw new BadRequestException({
      code: 'CAR_OPERACION_VACIA',
      message: 'El número de operación del depósito es obligatorio para el CAR.',
    });
  }
  if (operacion.length > 19) {
    throw new BadRequestException({
      code: 'CAR_OPERACION_LARGA',
      message:
        `El número de operación tiene ${operacion.length} dígitos y el CAR ` +
        'solo reserva 19. Verifique el número del depósito.',
    });
  }

  // 1 + 2 + 1 + 3 + 19 = 26; el último dígito lo reserva SUNAT y va en cero
  // para que el conjunto sume los 27 exigidos por el registro.
  const car = [
    moneda,
    PAR_RESERVADO,
    tipoOperacion,
    recaudador,
    operacion.padStart(19, '0'),
    '0',
  ].join('');

  if (!esCarValido(car)) {
    throw new BadRequestException({
      code: 'CAR_LONGITUD_INVALIDA',
      message: `El CAR resultante no tiene 27 dígitos: "${car}".`,
    });
  }

  return car;
};

/**
 * Descompone un CAR en sus partes, para mostrar u auditar.
 *
 * Devuelve `null` si el código no tiene la forma esperada; no lanza, porque se
 * usa para leer datos que pueden venir de terceros.
 */
export const descomponerCar = (
  car: string,
): {
  moneda: string;
  parReservado: string;
  tipoOperacion: string;
  recaudador: string;
  operacion: string;
} | null => {
  if (!esCarValido(car)) return null;

  return {
    moneda: car.slice(0, 1),
    parReservado: car.slice(1, 3),
    tipoOperacion: car.slice(3, 4),
    recaudador: car.slice(4, 7),
    operacion: car.slice(7, 26),
  };
};
