/**
 * Orquestacion de TA-03: XML firmado -> peticion SOAP -> CDR -> estado.
 *
 * Responsabilidades:
 *  1. Ejecutar el POST SOAP contra el billService con el XML firmado en Base64
 *     y los namespaces verificados.
 *  2. Decodificar Base64 -> ZIP -> XML (parseCdr).
 *  3. Extraer ID, codigo y descripcion, y clasificar el estado.
 *  4. Manejar SOAP Fault y timeout SIN perder el job (persiste la traza).
 *  5. Registrar tiempo_respuesta_ms por intento.
 *
 * NO incluye: firma XMLDSig (TA-07), worker de la cola (HU-04) ni
 * backoff/circuit breaker (Sprint 2).
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CdrPersistenceService } from './cdr-persistence.service';
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

  /** Evita repetir el aviso de credenciales faltantes en cada envio. */
  private credencialesFaltantesAvisadas = false;

  constructor(
    private readonly persistence: CdrPersistenceService,
    private readonly soapClient: SunatSoapClient,
  ) {}

  /** Crea el servicio resolviendo endpoint y timeout del entorno. */
  static create(
    persistence: CdrPersistenceService,
    client?: SunatSoapClient,
  ): SunatBillService {
    return new SunatBillService(
      persistence,
      client ??
        new SunatSoapClient({
          endpoint: resolveEndpoint(),
          timeoutMs: resolveTimeout(),
        }),
    );
  }

  /** Nombre del ZIP que espera SUNAT: una sola convencion (ADR-07). */
  private buildFileName(params: SendInvoiceParams): string {
    return buildZipFileName({
      ruc: params.rucEmisor,
      tipoComprobante: params.tipoComprobante,
      serie: params.serie,
      correlativo: params.correlativo,
    });
  }

  /**
   * Resuelve las credenciales SOL desde variables de entorno (TT-05).
   * Si falta alguna devuelve null (el sobre va sin WS-Security, valido solo
   * contra el Mock) y deja UNA advertencia con los NOMBRES de las variables
   * faltantes. Nunca se registran valores de credenciales.
   */
  private resolveCredentials(rucEmisor: string) {
    const password = process.env.SUNAT_SOL_PASSWORD;
    const username = buildSolUsername(rucEmisor);

    if (!username || !password) {
      if (!this.credencialesFaltantesAvisadas) {
        const faltantes = [
          !process.env.SUNAT_SOL_USER ? 'SUNAT_SOL_USER' : null,
          !password ? 'SUNAT_SOL_PASSWORD' : null,
        ]
          .filter(Boolean)
          .join(', ');
        this.logger.warn(
          `Credenciales SOL incompletas (falta: ${faltantes}). ` +
            'El sobre SOAP se enviara SIN WS-Security; SUNAT lo rechazara ' +
            'con 0101/0102. Valido solo contra el Mock.',
        );
        this.credencialesFaltantesAvisadas = true;
      }
      return null;
    }

    return { username, password };
  }

  /**
   * Envia un comprobante, clasifica el CDR y persiste el resultado.
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
        return await this.failure(
          params,
          'El billService respondio sin applicationResponse: CDR no encontrado',
          InvoiceStatus.ERROR_RED,
          null,
          null,
          true,
          tiempoRespuestaMs,
        );
      }

      const cdr = parseCdr(applicationResponse);
      const clasificacion = classifyCdr(cdr);

      this.logger.log(
        `CDR ${cdr.responseCode} (${clasificacion.kind}) para ${
          cdr.referenceId ?? params.invoiceId
        } en ${tiempoRespuestaMs} ms`,
      );

      // Criterios 3 y 6: se persiste el CDR en cdr_sunat y la traza con
      // tiempo_respuesta_ms en TransactionHistory, en una sola transaccion.
      try {
        await this.persistence.persist({
          invoiceId: params.invoiceId,
          cdr,
          classification: clasificacion,
          tiempoRespuestaMs,
          estadoAnterior: params.estadoActual ?? null,
          intento: params.intento ?? 1,
        });
      } catch (error) {
        // El CDR llego pero no se pudo guardar: es un fallo de persistencia, NO
        // un fallo de comunicacion. Se distingue para que la capa de cola sepa
        // que reenviar el comprobante es seguro pero guardarlo no funciono.
        this.logger.error(
          `No se pudo persistir el CDR de ${params.invoiceId}: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`,
        );
        throw new InternalServerErrorException(
          'CDR recibido pero no se pudo persistir: PERSISTENCE_FAILED',
        );
      }

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
      // Si es el fallo de persistencia recien lanzado, no se debe enmascarar
      // como fallo de red: se propaga tal cual.
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      return await this.handleError(params, error);
    }
  }

  /**
   * Maneja SOAP Fault y errores de transporte SIN perder el job.
   * En ningun camino se descarta el comprobante: se persiste su estado y el
   * motivo, para que el backoff reintente o un humano lo revise.
   */
  private async handleError(
    params: SendInvoiceParams,
    error: unknown,
  ): Promise<ProcessCdrResult> {
    // SOAP Fault: error de NEGOCIO. El codigo del fault se clasifica con la
    // misma tabla que el ResponseCode, porque SUNAT usa la misma numeracion.
    if (isSunatSoapFaultError(error)) {
      const codigo = error.sunatCode ?? '';
      const clasificacion = classifyResponseCode(codigo);

      this.logger.warn(
        `SOAP Fault al enviar ${params.invoiceId}: ${error.message}`,
      );

      return await this.failure(
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
      return await this.failure(
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
      return await this.failure(
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

    return await this.failure(
      params,
      mensaje,
      InvoiceStatus.ERROR_RED,
      null,
      null,
      true,
    );
  }

  /**
   * Construye el resultado de un fallo Y lo audita.
   * Criterio 5: sin perder el job. El fallo se deja registrado con su codigo y
   * su motivo, para que el backoff reintente o un humano lo revise.
   */
  private async failure(
    params: SendInvoiceParams,
    mensaje: string,
    estado: InvoiceStatus,
    responseCode: string | null,
    clasificacion: CdrClassification | null,
    reintentable: boolean,
    tiempoRespuestaMs: number | null = null,
  ): Promise<ProcessCdrResult> {
    try {
      await this.persistence.persistFailure({
        invoiceId: params.invoiceId,
        estadoNuevo: estado,
        estadoAnterior: params.estadoActual ?? null,
        intento: params.intento ?? 1,
        codigoError: responseCode,
        mensajeError: mensaje,
        tiempoRespuestaMs,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo auditar el fallo de ${params.invoiceId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }

    return {
      invoiceId: params.invoiceId,
      responseCode: responseCode ?? '',
      estado,
      valido: false,
      reintentable,
      clasificacion: clasificacion ?? classifyCdr(EMPTY_PARSED_CDR),
      cdr: null,
      tiempoRespuestaMs,
      error: mensaje,
    };
  }
}
