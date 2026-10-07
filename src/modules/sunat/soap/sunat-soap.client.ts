/**
 * Cliente SOAP del billService de SUNAT (operacion sendBill).
 *
 * Se usa fetch nativo de Node (undici) en lugar de una libreria SOAP: el
 * contrato es document/literal con una sola operacion, asi que una peticion
 * HTTP con un sobre construido a mano es mas simple y no anade dependencias.
 * Ver ADR-02.
 *
 * OJO CON EL TIMEOUT: el headersTimeout por defecto de undici es de 300 s. Sin
 * un AbortSignal explicito, un cuelgue de SUNAT bloquea el worker hasta 5
 * minutos. Por eso TODA peticion lleva timeout.
 *
 * El AbortSignal.timeout hace que fetch() rechace con un error cuyo name es
 * 'TimeoutError' (verificado con Node v24.21.0). Por eso la deteccion del
 * timeout comprueba el name antes de cualquier otra cosa.
 */
import {
  buildSendBillEnvelope,
  parseSendBillResponse,
  SendBillCredentials,
  SunatSoapFaultError,
} from './soap-envelope';
import {
  SUNAT_BILL_SERVICE_URLS,
  SUNAT_DEFAULT_TIMEOUT_MS,
  SUNAT_SEND_BILL_SOAP_ACTION,
} from './soap.constants';

/** Fallo de transporte: la peticion no obtuvo una respuesta valida. */
export class SunatTransportError extends Error {
  /** true: el comprobante no fue informado, reintentar es seguro. */
  readonly reintentable = true;
  readonly httpStatus: number | null;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: { httpStatus?: number | null; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'SunatTransportError';
    this.httpStatus = options.httpStatus ?? null;
    this.cause = options.cause;
  }
}

export function isSunatTransportError(
  error: unknown,
): error is SunatTransportError {
  return error instanceof SunatTransportError;
}

export function isSunatSoapFaultError(
  error: unknown,
): error is SunatSoapFaultError {
  return error instanceof SunatSoapFaultError;
}

export interface SendBillParams {
  /** Nombre del ZIP: RUC-TIPO-SERIE-CORRELATIVO.zip */
  fileName: string;
  /** ZIP con el XML firmado (sin codificar: el cliente lo pasa a Base64). */
  zip: Buffer;
  /** Credenciales SOL; si son null el sobre va sin WS-Security (Mock). */
  credentials?: SendBillCredentials | null;
}

export interface SendBillResult {
  /** CDR: Base64 del ZIP con el XML ApplicationResponse. */
  applicationResponse: string | null;
  /**
   * Milisegundos que tardo la peticion: es el tiempo_respuesta_ms que exige el
   * criterio 6 de TA-03, medido por intento.
   */
  tiempoRespuestaMs: number;
  httpStatus: number;
  /** Cuerpo crudo de la respuesta, util para diagnostico y auditoria. */
  rawResponse: string;
}

export class SunatSoapClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options?: { endpoint?: string; timeoutMs?: number }) {
    this.endpoint = options?.endpoint ?? SUNAT_BILL_SERVICE_URLS.beta;
    this.timeoutMs = options?.timeoutMs ?? SUNAT_DEFAULT_TIMEOUT_MS;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Ejecuta sendBill y devuelve el CDR en Base64.
   *
   * Errores posibles:
   *  - SunatSoapFaultError: SUNAT respondio con un Fault. Es un error de
   *    NEGOCIO y normalmente llega con HTTP 500; no se trata como red.
   *  - SunatTransportError: timeout, DNS, conexion cortada o 5xx sin Fault.
   */
  async sendBill(params: SendBillParams): Promise<SendBillResult> {
    const envelope = buildSendBillEnvelope({
      fileName: params.fileName,
      contentFileBase64: params.zip.toString('base64'),
      credentials: params.credentials ?? null,
    });

    const startedAt = Date.now();
    let response: Response;
    let rawResponse: string;

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${SUNAT_SEND_BILL_SOAP_ACTION}"`,
          // Longitud en BYTES, no en caracteres: el sobre puede llevar tildes.
          'Content-Length': String(Buffer.byteLength(envelope, 'utf8')),
        },
        body: envelope,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      // La lectura del cuerpo se hace DENTRO del try: el AbortSignal tambien
      // puede dispararse durante esta fase, y ese error debe tratarse igual.
      rawResponse = await response.text();
    } catch (error) {
      const tiempoRespuestaMs = Date.now() - startedAt;
      const nombre = getErrorName(error);
      const mensaje = getErrorMessage(error);

      if (nombre === 'TimeoutError' || nombre === 'AbortError') {
        throw new SunatTransportError(
          `Timeout de ${this.timeoutMs} ms esperando al billService. El comprobante quedo en estado incierto: NO reenviar a ciegas, conciliar con billConsultService`,
          { cause: error },
        );
      }

      throw new SunatTransportError(
        `Error de red contra el billService (${tiempoRespuestaMs} ms): ${mensaje}`,
        { cause: error },
      );
    }

    const tiempoRespuestaMs = Date.now() - startedAt;

    // SOAP Fault: es un error de negocio. Se detecta ANTES de mirar el status
    // HTTP, porque SUNAT devuelve los Faults con HTTP 500 y un reintento ciego
    // solo repetiria el mismo error.
    const { applicationResponse, fault } = parseSendBillResponse(rawResponse);
    if (fault) {
      throw fault;
    }

    if (!response.ok) {
      throw new SunatTransportError(
        `El billService respondio HTTP ${response.status} sin SOAP Fault parseable`,
        { httpStatus: response.status },
      );
    }

    return {
      applicationResponse,
      tiempoRespuestaMs,
      httpStatus: response.status,
      rawResponse,
    };
  }
}

/**
 * Nombre del error, sin asumir que sea una instancia de Error.
 *
 * Los errores de abort de undici son DOMException, y un fallo de red puede
 * llegar como un objeto sin prototipo de Error. Leer `name` de forma defensiva
 * evita clasificar un timeout como "error desconocido".
 */
function getErrorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    return String((error as { name: unknown }).name);
  }
  return '';
}

/** Mensaje legible del error, con respaldo si no trae ninguno. */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message) return message;
  }
  const nombre = getErrorName(error);
  return nombre ? `error de red (${nombre})` : 'error desconocido';
}
