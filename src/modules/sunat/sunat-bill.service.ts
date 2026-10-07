/**
 * Orquestacion de TA-03: XML firmado -> peticion SOAP -> CDR -> estado.
 *
 * Responsabilidades:
 *  1. Ejecutar el POST SOAP contra el billService con el XML firmado en Base64
 *     y los namespaces verificados.
 *  2. Decodificar Base64 -> ZIP -> XML (parseCdr).
 *  3. Extraer ID, codigo y descripcion, y clasificar el estado.
 *  4. Manejar SOAP Fault y timeout SIN perder el job.
 *  5. Registrar tiempo_respuesta_ms por intento.
 *
 * NO incluye: persistencia (la hace el llamador con el resultado), firma XMLDSig
 * (TA-07), worker de la cola (HU-04) ni backoff/circuit breaker (Sprint 2).
 */
import { Injectable, Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../generated/prisma/enums';
import { classifyCdr } from './soap/cdr.classifier';
import { CdrClassification, classifyResponseCode } from './soap/cdr-classifier';
import {
  CdrDecodeError,
  EMPTY_PARSED_CDR,
  ParsedCdr,
  parseCdr,
} from './soap/cdr.parser';
import {
  isSunatSoapFaultError,
  isSunatTransportError,
  SunatSoapClient,
} from './soap/sunat-soap.client';
import {
  buildZipFileName,
  SUNAT_BILL_SERVICE_URLS,
  SUNAT_DEFAULT_TIMEOUT_MS,
} from './soap/soap.constants';

export interface SendInvoiceParams {
  invoiceId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  /** ZIP con el XML firmado, listo para enviar. */
  zip: Buffer;
  /** Estado actual del comprobante (para la auditoria del historial). */
  estadoActual?: InvoiceStatus | null;
  /** Numero de intento. */
  intento?: number;
}

export interface ProcessCdrResult {
  invoiceId: string;
  responseCode: string;
  estado: InvoiceStatus;
  valido: boolean;
  reintentable: boolean;
  clasificacion: CdrClassification;
  cdr: ParsedCdr | null;
  tiempoRespuestaMs: number | null;
  error: string | null;
}

/**
 * Endpoint segun entorno:
 *  - SUNAT_BILL_SERVICE_URL tiene prioridad (permite apuntar al Mock).
 *  - SUNAT_ENV=produccion usa produccion; cualquier otro valor usa beta.
 */
export function resolveEndpoint(): string {
  if (process.env.SUNAT_BILL_SERVICE_URL) {
    return process.env.SUNAT_BILL_SERVICE_URL;
  }
  return process.env.SUNAT_ENV === 'produccion'
    ? SUNAT_BILL_SERVICE_URLS.produccion
    : SUNAT_BILL_SERVICE_URLS.beta;
}

export function resolveTimeout(): number {
  const raw = Number(process.env.SUNAT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : SUNAT_DEFAULT_TIMEOUT_MS;
}

/**
 * Usuario SOL de SUNAT = RUC + usuario secundario.
 * SUNAT rechaza con 0102/0112 si se envia solo el usuario secundario, asi que
 * se antepone el RUC salvo que ya venga incluido.
 */
function buildSolUsername(rucEmisor: string): string | null {
  const solUser = process.env.SUNAT_SOL_USER;
  if (!solUser) return null;
  return solUser.startsWith(rucEmisor) ? solUser : `${rucEmisor}${solUser}`;
}

@Injectable()
export class SunatBillService {
  private readonly logger = new Logger(SunatBillService.name);

  constructor(private readonly soapClient: SunatSoapClient) {}

  /** Nombre del ZIP que espera SUNAT: una sola convencion (ADR-07). */
  private buildFileName(params: SendInvoiceParams): string {
    return buildZipFileName({
      ruc: params.rucEmisor,
      tipoComprobante: params.tipoComprobante,
      serie: params.serie,
      correlativo: params.correlativo,
    });
  }

  private resolveCredentials(rucEmisor: string) {
    const password = process.env.SUNAT_SOL_PASSWORD;
    const username = buildSolUsername(rucEmisor);
    if (!username || !password) return null;
    return { username, password };
  }

  /**
   * Envia un comprobante y devuelve el resultado clasificado.
   * NUNCA lanza por un fallo de SUNAT: devuelve el resultado con reintentable
   * para que la capa de cola decida el backoff.
   */
  async sendAndProcess(params: SendInvoiceParams): Promise<ProcessCdrResult> {
    try {
      const { applicationResponse, tiempoRespuestaMs } =
        await this.soapClient.sendBill({
          fileName: this.buildFileName(params),
          zip: params.zip,
          credentials: this.resolveCredentials(params.rucEmisor),
        });

      if (!applicationResponse) {
        return this.failure(
          params,
          'El billService respondio sin applicationResponse: CDR no encontrado',
          InvoiceStatus.ERROR_RED,
          null,
          null,
          true,
        );
      }

      const cdr = parseCdr(applicationResponse);
      const clasificacion = classifyCdr(cdr);

      this.logger.log(
        `CDR ${cdr.responseCode} (${clasificacion.kind}) para ${
          cdr.referenceId ?? params.invoiceId
        } en ${tiempoRespuestaMs} ms`,
      );

      return {
        invoiceId: params.invoiceId,
        responseCode: cdr.responseCode,
        estado: clasificacion.status,
        valido: clasificacion.valido,
        reintentable: clasificacion.reintentable,
        clasificacion,
        cdr,
        tiempoRespuestaMs,
        error: null,
      };
    } catch (error) {
      return this.handleError(params, error);
    }
  }

  /**
   * Maneja SOAP Fault y errores de transporte SIN perder el job.
   * En ningun camino se descarta el comprobante: se devuelve su estado y el
   * motivo, para que el llamador lo audite.
   */
  private handleError(
    params: SendInvoiceParams,
    error: unknown,
  ): ProcessCdrResult {
    // SOAP Fault: error de NEGOCIO. El codigo del fault se clasifica con la
    // misma tabla que el ResponseCode, porque SUNAT usa la misma numeracion.
    if (isSunatSoapFaultError(error)) {
      const codigo = error.sunatCode ?? '';
      const clasificacion = classifyResponseCode(codigo);

      this.logger.warn(
        `SOAP Fault al enviar ${params.invoiceId}: ${error.message}`,
      );

      return this.failure(
        params,
        error.message,
        clasificacion.status,
        codigo,
        clasificacion,
        clasificacion.reintentable,
      );
    }

    // ZIP o CDR ilegible: error de integracion.
    if (error instanceof CdrDecodeError) {
      return this.failure(
        params,
        `No se pudo decodificar el CDR: ${error.message}`,
        InvoiceStatus.ERROR_RED,
        null,
        null,
        true,
      );
    }

    /*
     * Error de transporte: timeout, DNS o 5xx sin Fault.
     *
     * sendBill NO es idempotente. Si hubo timeout despues de que SUNAT proceso
     * el comprobante, el reintento devolvera 0402 o 1033 y el comprobante ya
     * esta ACEPTADO en SUNAT. Por eso el estado correcto es ENVIADO (incierto,
     * hay que conciliar con billConsultService), no ERROR_RED: marcarlo como
     * error de red invitaria a reenviar y a duplicar el comprobante. Ver ADR-06.
     */
    if (isSunatTransportError(error)) {
      return this.failure(
        params,
        `${error.message}. Conciliar con billConsultService antes de reenviar`,
        InvoiceStatus.ENVIADO,
        null,
        null,
        true,
      );
    }

    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido';
    this.logger.error(
      `Fallo al enviar ${params.invoiceId} al billService: ${mensaje}`,
    );

    return this.failure(
      params,
      mensaje,
      InvoiceStatus.ERROR_RED,
      null,
      null,
      true,
    );
  }

  private failure(
    params: SendInvoiceParams,
    mensaje: string,
    estado: InvoiceStatus,
    responseCode: string | null,
    clasificacion: CdrClassification | null,
    reintentable: boolean,
  ): ProcessCdrResult {
    return {
      invoiceId: params.invoiceId,
      responseCode: responseCode ?? '',
      estado,
      valido: false,
      reintentable,
      clasificacion: clasificacion ?? classifyCdr(EMPTY_PARSED_CDR),
      cdr: null,
      tiempoRespuestaMs: null,
      error: mensaje,
    };
  }
}
