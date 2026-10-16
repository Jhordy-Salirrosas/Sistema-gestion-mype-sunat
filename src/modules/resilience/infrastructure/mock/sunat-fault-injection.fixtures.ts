/**
 * Catalogo de fallos inyectables del Mock del billService (TA-12).
 *
 * Los modos se activan por el RUC emisor, que viaja dentro del nombre del
 * archivo ZIP del propio request SOAP:
 *
 *   <ser:sendBill>
 *     <fileName>20111111112-01-F001-1.zip</fileName>
 *   </ser:sendBill>
 *
 * No existe un campo ruc_emisor en el contrato: el RUC son los 11 primeros
 * caracteres del fileName. Es la misma convencion que usa el cliente real
 * (buildZipFileName en soap.constants.ts).
 *
 * Los 4 RUC cumplen el algoritmo de digito verificador (Modulo 11) de SUNAT,
 * verificado con el mismo algoritmo del validador de RUC del proyecto:
 *
 *   RUC          suma  resto  DV
 *   20111111112   42     9     2
 *   20222222223   74     8     3
 *   20333333334  106     7     4
 *   20444444445  138     6     5
 *
 * Nota sobre el modo SOAP_FAULT: SUNAT devuelve los SOAP Fault con HTTP 500, no
 * con HTTP 400. El error es de negocio, no de formato de la peticion, y el
 * SunatSoapClient de TA-03 lo distingue por el cuerpo antes de mirar el codigo
 * HTTP. Esa es la razon de que el mapa de codigos lo asigne a 500.
 *
 * Cualquier otro RUC recibe la respuesta normal (CDR aceptado, codigo 0).
 */
import { HttpStatus } from '@nestjs/common';

/** Modos de fallo que el Mock puede simular. */
export enum SunatFaultMode {
  /** HTTP 503: el servicio de SUNAT no esta disponible. */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  /** Demora mayor a 10 s: simula una SUNAT saturada. */
  TIMEOUT = 'TIMEOUT',
  /** SOAP Fault: error de negocio devuelto por SUNAT. */
  SOAP_FAULT = 'SOAP_FAULT',
  /** Latencia configurable, para pruebas de rendimiento. */
  SLOW = 'SLOW',
}

/**
 * RUC que activa cada modo. Se elige el RUC y no una palabra clave para que el
 * modo se pueda activar desde el cliente real sin cambiar la peticion.
 */
export const FAULT_RUC_BY_MODE: Readonly<Record<SunatFaultMode, string>> = {
  [SunatFaultMode.SERVICE_UNAVAILABLE]: '20111111112',
  [SunatFaultMode.TIMEOUT]: '20222222223',
  [SunatFaultMode.SOAP_FAULT]: '20333333334',
  [SunatFaultMode.SLOW]: '20444444445',
};

/** Codigo HTTP que devuelve cada modo. */
export const FAULT_HTTP_STATUS_BY_MODE: Readonly<
  Record<SunatFaultMode, number>
> = {
  [SunatFaultMode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  // Un SOAP Fault de SUNAT llega con HTTP 500, no 400: el error es de negocio,
  // no de formato de la peticion.
  [SunatFaultMode.SOAP_FAULT]: HttpStatus.INTERNAL_SERVER_ERROR,
  [SunatFaultMode.TIMEOUT]: HttpStatus.OK,
  [SunatFaultMode.SLOW]: HttpStatus.OK,
};

/** Codigo de fault del modo SOAP_FAULT (encabezado de seguridad incorrecto). */
export const FAULT_SOAP_CODE = '0101';
export const FAULT_SOAP_MESSAGE = 'El encabezado de seguridad es incorrecto';

/**
 * Demora por defecto del modo TIMEOUT, en milisegundos.
 * El criterio pide "mas de 10 s"; se usan 15 s para superarlo con margen sin
 * llegar al timeout del cliente (30 s), que ya esta cubierto por las pruebas
 * del SunatSoapClient de TA-03.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** Demora por defecto del modo SLOW, en milisegundos. */
export const DEFAULT_SLOW_MS = 3_000;

/**
 * Variables de entorno que ajustan las latencias. Se leen en CADA peticion, no
 * al arrancar la aplicacion: eso es lo que permite ajustarlas sin reiniciar el
 * servicio ni tocar codigo (criterio 4).
 *
 * Las pruebas las reducen a milisegundos para no esperar 15 s por caso.
 */
export const TIMEOUT_MS_ENV_VAR = 'SUNAT_MOCK_TIMEOUT_MS';
export const SLOW_MS_ENV_VAR = 'SUNAT_MOCK_SLOW_MS';

/** Lee un numero no negativo del entorno, o devuelve el valor por defecto. */
function resolveMs(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Demora del modo TIMEOUT: 15 s por defecto, ajustable sin reiniciar. */
export function resolveTimeoutMs(): number {
  return resolveMs(TIMEOUT_MS_ENV_VAR, DEFAULT_TIMEOUT_MS);
}

/** Demora del modo SLOW: 3 s por defecto, ajustable sin reiniciar. */
export function resolveSlowMs(): number {
  return resolveMs(SLOW_MS_ENV_VAR, DEFAULT_SLOW_MS);
}

/**
 * Extrae el RUC emisor de los 11 primeros caracteres del nombre del archivo ZIP.
 * Devuelve null si el nombre no trae un RUC reconocible.
 */
export function extractRucFromFileName(fileName: string): string | null {
  const match = /^(\d{11})/.exec((fileName ?? '').trim());
  return match ? match[1] : null;
}

/** Traduce un RUC a su modo de fallo, o null si es un RUC normal. */
export function resolveFaultMode(ruc: string | null): SunatFaultMode | null {
  if (!ruc) {
    return null;
  }
  const found = Object.entries(FAULT_RUC_BY_MODE).find(
    ([, value]) => value === ruc,
  );
  return found ? (found[0] as SunatFaultMode) : null;
}

/** Espera asincrona, sin dependencias externas. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
