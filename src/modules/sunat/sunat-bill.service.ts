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
import { classifyCdr } from './soap/cdr.classifier';
import { handleSunatBillError } from './soap/sunatBillErrorHandler';
import { parseCdr } from './soap/cdr.parser';
import { SunatSoapClient } from './soap/sunat-soap.client';
import {
  isSunatSoapFaultError,
  isSunatTransportError,
} from './soap/sunat-soap.client';
import { ResilienceStateService } from '../resilience/application/resilienceStateService';
import { buildZipFileName } from './soap/soap.constants';

import {
  SendInvoiceParams,
  ProcessCdrResult,
  resolveEndpoint,
  resolveTimeout,
  buildSolUsername,
} from './soap/sunatBillTypes';

export type {
  SendInvoiceParams,
  ProcessCdrResult,
};
export {
  resolveEndpoint,
  resolveTimeout,
};

@Injectable()
export class SunatBillService {
  private readonly logger = new Logger(SunatBillService.name);

  /** Evita repetir el aviso de credenciales faltantes en cada envio. */
  private credencialesFaltantesAvisadas = false;

  constructor(
    private readonly persistence: CdrPersistenceService,
    private readonly soapClient: SunatSoapClient,
    private readonly resilienceState?: ResilienceStateService,
  ) {}

  /** Crea el servicio resolviendo endpoint y timeout del entorno. */
  static create(
    persistence: CdrPersistenceService,
    client?: SunatSoapClient,
    resilienceState?: ResilienceStateService,
  ): SunatBillService {
    return new SunatBillService(
      persistence,
      client ??
        new SunatSoapClient({
          endpoint: resolveEndpoint(),
          timeoutMs: resolveTimeout(),
        }),
      resilienceState,
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
    let soapResponded = false;
    let httpStatusCode: number | null = null;
    let elapsedMs: number | null = null;
    try {
      const { applicationResponse, tiempoRespuestaMs, httpStatus } =
        await this.soapClient.sendBill({
          fileName: this.buildFileName(params),
          zip: params.zip,
          credentials: this.resolveCredentials(params.rucEmisor),
        });
      soapResponded = true;
      httpStatusCode = httpStatus;
      elapsedMs = tiempoRespuestaMs;
      this.resilienceState?.recordSuccess();

      if (!applicationResponse) {
        return await handleSunatBillError(
          params,
          new Error(
            'El billService respondio sin applicationResponse: CDR no encontrado',
          ),
          this.persistence,
          this.logger,
          { httpStatusCode, elapsedMs },
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
          httpStatusCode,
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
      if (isSunatTransportError(error)) {
        httpStatusCode = error.httpStatus;
        elapsedMs = error.elapsedMs;
      } else if (isSunatSoapFaultError(error)) {
        httpStatusCode = error.httpStatusCode;
        elapsedMs = error.elapsedMs;
      }

      if (!soapResponded) {
        if (isSunatTransportError(error) &&
          (error.httpStatus === null || error.httpStatus >= 500)) {
          this.resilienceState?.recordFailure();
        } else {
          this.resilienceState?.recordSuccess();
        }
      }
      // Si es el fallo de persistencia recien lanzado, no se debe enmascarar
      // como fallo de red: se propaga tal cual.
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      return await this.handleError(params, error, {
        httpStatusCode,
        elapsedMs,
      });
    }
  }

  private async handleError(
    params: SendInvoiceParams,
    error: unknown,
    observation: { httpStatusCode: number | null; elapsedMs: number | null },
  ): Promise<ProcessCdrResult> {
    return handleSunatBillError(
      params,
      error,
      this.persistence,
      this.logger,
      observation,
    );
  }
}
