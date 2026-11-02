/**
 * TA-28 - Clasificacion de fallos del pipeline de envio a SUNAT.
 *
 * El defecto que corrige este archivo: el worker trataba TODO error igual y
 * marcaba la factura como FALLIDO en el primer intento, sin reintentar ni
 * enviar el trabajo a la DLQ.
 *
 * La distincion que exige la HU (criterio 4) es:
 *
 *  - TRANSIENTE: la red fallo o SUNAT no atendio (503/500, ECONNREFUSED,
 *    timeout antes de transmitir). Reintentar tiene sentido y al agotar los
 *    intentos el job va a la DLQ con ERROR_RED.
 *
 *  - DEFINITIVO: el comprobante esta mal (XSD invalido, certificado vencido,
 *    SOAP Fault de negocio). Reintentar solo repite el mismo error: se corta
 *    el bucle y se marca FALLIDO.
 *
 *  - INCIERTO: el sobre SI se transmitio pero la respuesta se perdio
 *    (ETIMEDOUT). Aqui NO se puede reintentar a ciegas sin arriesgar un
 *    duplicado 1033/1032: hay que consultar el estado con getStatusCdr antes
 *    de decidir.
 */
import {
  isSunatSoapFaultError,
  isSunatTransportError,
  SunatTransportError,
} from '../sunat/soap/sunat-soap.client';
import type { SunatSoapFaultError } from '../sunat/soap/soap-envelope';

/** Naturaleza de un fallo del pipeline. */
export type ClaseFallo = 'TRANSIENTE' | 'DEFINITIVO' | 'INCIERTO';

export interface FalloClasificado {
  clase: ClaseFallo;
  /** true solo para TRANSIENTE: el job debe reintentarse. */
  reintentable: boolean;
  /** true solo para INCIERTO: hay que confirmar con getStatusCdr. */
  requiereConsultaEstado: boolean;
  codigo: string;
  mensaje: string;
  httpStatus: number | null;
}

/** Codigos de error de red de Node que indican que el sobre no salio. */
const CODIGOS_RED_NO_ENVIADO = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

/** Codigos de error que indican que el sobre pudo haber salido. */
const CODIGOS_INCIERTOS = new Set([
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNABORTED',
]);

/** Mensajes que el proyecto ya usa para un error definitivo del pipeline. */
const MARCAS_DEFINITIVAS = [
  'XSD',
  'ERR_XSD',
  'Certificado digital',
  'certificado',
  'PKCS#12',
  'ERROR_VALIDACION',
];

function leerCodigo(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const codigo = (error as { code: unknown }).code;
    if (typeof codigo === 'string') return codigo;
  }
  return null;
}

function leerMensaje(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Error desconocido en el pipeline de envio';
}

/**
 * Clasifica un error del pipeline.
 *
 * El orden de las comprobaciones importa: un SOAP Fault llega con HTTP 500 y
 * comparte status con un 503 de indisponibilidad, pero NO es recuperable.
 */
export function clasificarFallo(error: unknown): FalloClasificado {
  const mensaje = leerMensaje(error);
  const codigo = leerCodigo(error);

  // 1. SOAP Fault: SUNAT respondio y el error es determinista.
  if (isSunatSoapFaultError(error)) {
    const fault = error as SunatSoapFaultError;
    return {
      clase: 'DEFINITIVO',
      reintentable: false,
      requiereConsultaEstado: false,
      codigo: fault.sunatCode ?? 'SOAP_FAULT',
      mensaje,
      httpStatus: 500,
    };
  }

  // 2. Error de transporte del cliente SOAP.
  if (isSunatTransportError(error)) {
    const httpStatus = (error as SunatTransportError).httpStatus;

    // Timeout: el sobre pudo haber salido -> estado incierto.
    if (/timeout/i.test(mensaje)) {
      return {
        clase: 'INCIERTO',
        reintentable: false,
        requiereConsultaEstado: true,
        codigo: 'SOAP_TIMEOUT',
        mensaje,
        httpStatus,
      };
    }

    // El resto de fallos de transporte (5xx, 429, red caída) son transitorios:
    // SUNAT no atendió o la red falló antes de transmitir.
    return {
      clase: 'TRANSIENTE',
      reintentable: true,
      requiereConsultaEstado: false,
      codigo: httpStatus ? `HTTP_${httpStatus}` : 'ERROR_RED',
      mensaje,
      httpStatus,
    };
  }

  // 3. Codigos de red crudos de Node.
  if (codigo && CODIGOS_INCIERTOS.has(codigo)) {
    return {
      clase: 'INCIERTO',
      reintentable: false,
      requiereConsultaEstado: true,
      codigo,
      mensaje,
      httpStatus: null,
    };
  }

  if (codigo && CODIGOS_RED_NO_ENVIADO.has(codigo)) {
    return {
      clase: 'TRANSIENTE',
      reintentable: true,
      requiereConsultaEstado: false,
      codigo,
      mensaje,
      httpStatus: null,
    };
  }

  // 4. Errores del propio pipeline: validacion XSD, certificado, etc.
  if (MARCAS_DEFINITIVAS.some((marca) => mensaje.includes(marca))) {
    return {
      clase: 'DEFINITIVO',
      reintentable: false,
      requiereConsultaEstado: false,
      codigo: 'ERR_PIPELINE',
      mensaje,
      httpStatus: null,
    };
  }

  // 5. Desconocido: se trata como definitivo para no duplicar envios.
  return {
    clase: 'DEFINITIVO',
    reintentable: false,
    requiereConsultaEstado: false,
    codigo: 'ERR_DESCONOCIDO',
    mensaje,
    httpStatus: null,
  };
}

/**
 * Tiempo de espera antes del siguiente intento con backoff exponencial.
 * t_k = t_base * 2^(k-1), acotado por el techo.
 */
export function calcularBackoffMs(
  intento: number,
  baseMs = 500,
  techoMs = 8_000,
): number {
  const exponente = Math.max(0, intento - 1);
  return Math.min(baseMs * 2 ** exponente, techoMs);
}
