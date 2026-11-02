/**
 * TA-28 - Orquestacion del envio real a SUNAT entre la cola y el cliente SOAP.
 *
 * El worker (`invoiceWorkerService`) solo generaba, validaba y firmaba el XML,
 * y terminaba en PROCESADO: el comprobante nunca salia hacia SUNAT. Este
 * servicio cierra ese tramo:
 *
 *   EN_COLA -> [Circuit Breaker] -> sendBill -> CDR -> estado final
 *
 * Reglas (criterios 2, 4, 5 y 6 de la HU):
 *
 *  - Criterio 5: se consulta el Circuit Breaker ANTES de tocar la red. Si esta
 *    bloqueando, el job NO se consume ni se reintenta: queda EN_COLA con la
 *    auditoria CIRCUIT_OPEN_DEFERRED. Lanzar una excepcion aqui seria un error,
 *    porque el bucle de reintentos lo contaria como fallo del comprobante.
 *
 *  - Criterio 4: los fallos TRANSIENTES se reintentan con backoff exponencial;
 *    al agotar los intentos el job va a la DLQ y la factura queda ERROR_RED.
 *
 *  - Criterio 6c: un INCIERTO (timeout tras transmitir) NO se reenvia: se
 *    consulta el estado con getStatusCdr. Solo si SUNAT responde 0127 se
 *    vuelve a enviar.
 */
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreaker } from '../resilience/infrastructure/circuitBreaker/circuitBreaker';
import { QueueService } from '../resilience/infrastructure/queue/queue.service';
import { CdrPersistenceService } from '../sunat/cdr-persistence.service';
import { classifyCdr } from '../sunat/soap/cdr.classifier';
import { parseCdr } from '../sunat/soap/cdr.parser';
import {
  SunatSoapClient,
  SunatTransportError,
} from '../sunat/soap/sunat-soap.client';
import {
  buildSolUsername,
  SendInvoiceParams,
} from '../sunat/soap/sunatBillTypes';
import { buildZipFileName } from '../sunat/soap/soap.constants';
import {
  calcularBackoffMs,
  clasificarFallo,
  FalloClasificado,
} from './invoiceFailureClassifier';
import {
  actualizarEstadoInvoice,
  registrarAuditoria,
} from './invoiceWorkerAudit';

/** Resultado de intentar despachar un comprobante. */
export interface DespachoResult {
  invoiceId: string;
  /** true: SUNAT respondio con CDR y el comprobante tiene estado final. */
  success: boolean;
  /** true: no se toco la red por Circuit Breaker abierto; sigue EN_COLA. */
  deferred: boolean;
  status: string;
  intentos: number;
  codigoError?: string;
  error?: string;
}

/** Intentos antes de rendirse y enviar el job a la DLQ. */
export const MAX_INTENTOS = 3;

/** Construye el ZIP con el XML firmado; se inyecta para poder simularlo. */
export interface ZipFirmadoProvider {
  construirZip: (params: SendInvoiceParams) => Promise<Buffer>;
}

@Injectable()
export class InvoiceDispatchService {
  private readonly logger = new Logger(InvoiceDispatchService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly persistence: CdrPersistenceService,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly zipProvider: ZipFirmadoProvider,
    private readonly soapClient: SunatSoapClient,
    private readonly prisma: unknown,
  ) {}

  /** Credenciales SOL; sin ellas el sobre va sin WS-Security (Mock). */
  private credenciales(rucEmisor: string) {
    const password = process.env.SUNAT_SOL_PASSWORD;
    const username = buildSolUsername(rucEmisor);
    return username && password ? { username, password } : null;
  }

  private async marcar(
    invoiceId: string,
    estado: string,
    anterior: string,
    codigo: string,
    mensaje: string,
    intento: number,
    tiempoMs = 0,
  ): Promise<void> {
    await actualizarEstadoInvoice(this.prisma, invoiceId, estado);
    await registrarAuditoria(
      this.prisma,
      invoiceId,
      intento,
      anterior,
      estado,
      codigo,
      mensaje,
      tiempoMs,
    );
  }

  /**
   * Criterio 5: si el circuito bloquea, el job se deja EN_COLA sin consumir
   * intento ni tocar la red.
   */
  private async diferirPorCircuitBreaker(
    params: SendInvoiceParams,
  ): Promise<DespachoResult> {
    this.logger.warn(
      `[CB OPEN] ${params.invoiceId} queda EN_COLA sin tocar la red (${this.circuitBreaker.getState()})`,
    );
    await this.marcar(
      params.invoiceId,
      'EN_COLA',
      params.estadoActual ?? 'EN_COLA',
      'CIRCUIT_OPEN_DEFERRED',
      'Circuit Breaker OPEN: job retenido en cola, no se consumio intento',
      params.intento ?? 1,
    );
    return {
      invoiceId: params.invoiceId,
      success: false,
      deferred: true,
      status: 'EN_COLA',
      intentos: 0,
    };
  }

  /** Despacha un comprobante. No lanza: devuelve el resultado del intento. */
  async despachar(params: SendInvoiceParams): Promise<DespachoResult> {
    if (this.circuitBreaker.estaBloqueando()) {
      return this.diferirPorCircuitBreaker(params);
    }

    let ultimoFallo: FalloClasificado | null = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
      try {
        return await this.intentarEnvio(params, intento);
      } catch (error) {
        const fallo = clasificarFallo(error);
        ultimoFallo = fallo;

        // Criterio 6c: estado incierto -> preguntar antes de reenviar.
        // Si SUNAT responde 0127 el comprobante NO llego y reenviar es seguro,
        // asi que este camino habilita el reintento aunque un timeout no lo sea.
        let reenvioConfirmadoSeguro = false;
        if (fallo.requiereConsultaEstado) {
          const recuperado = await this.recuperarPorConsulta(params, fallo);
          if (recuperado) return recuperado;
          reenvioConfirmadoSeguro = true;
        }

        this.logger.warn(
          `[${fallo.clase}] ${params.invoiceId} intento ${intento}: ${fallo.codigo} ${fallo.mensaje}`,
        );

        const puedeReintentar = fallo.reintentable || reenvioConfirmadoSeguro;
        if (!puedeReintentar) break;

        if (intento < MAX_INTENTOS) {
          await this.esperarBackoff(params, fallo, intento);
        }
      }
    }

    return this.rendirEnDlq(params, ultimoFallo);
  }

  /** Un intento completo: firmar, enviar y procesar el CDR. */
  private async intentarEnvio(
    params: SendInvoiceParams,
    intento: number,
  ): Promise<DespachoResult> {
    const zip = await this.zipProvider.construirZip(params);
    const fileName = buildZipFileName({
      ruc: params.rucEmisor,
      tipoComprobante: params.tipoComprobante,
      serie: params.serie,
      correlativo: params.correlativo,
    });

    this.logger.log(`[Envio] ${params.invoiceId} intento ${intento}/${MAX_INTENTOS}`);

    const { applicationResponse, tiempoRespuestaMs } =
      await this.soapClient.sendBill({
        fileName,
        zip,
        credentials: this.credenciales(params.rucEmisor),
      });

    if (!applicationResponse) {
      throw new SunatTransportError(
        'El billService respondio sin applicationResponse: CDR no encontrado',
      );
    }

    return this.procesarCdr(params, applicationResponse, tiempoRespuestaMs, intento);
  }

  /** Espera con backoff exponencial dejando traza de que sigue en cola. */
  private async esperarBackoff(
    params: SendInvoiceParams,
    fallo: FalloClasificado,
    intento: number,
  ): Promise<void> {
    const espera = calcularBackoffMs(intento);
    await this.marcar(
      params.invoiceId,
      'EN_COLA',
      params.estadoActual ?? 'EN_COLA',
      fallo.codigo,
      `Reintentando en ${espera} ms (intento ${intento}/${MAX_INTENTOS})`,
      intento,
    );
    await new Promise((resolver) => setTimeout(resolver, espera));
  }

  /** Criterio 4: intentos agotados -> DLQ + ERROR_RED. */
  private async rendirEnDlq(
    params: SendInvoiceParams,
    fallo: FalloClasificado | null,
  ): Promise<DespachoResult> {
    const codigo = fallo?.codigo ?? 'ERROR_RED';
    const mensaje = fallo?.mensaje ?? 'Fallo sin detalle';

    await this.queueService.moveToDlq({ invoice_id: params.invoiceId }, mensaje);
    await this.marcar(
      params.invoiceId,
      'ERROR_RED',
      'EN_COLA',
      codigo,
      `Agotados ${MAX_INTENTOS} intentos: enviado a sunat-invoice-dlq`,
      MAX_INTENTOS,
    );

    return {
      invoiceId: params.invoiceId,
      success: false,
      deferred: false,
      status: 'ERROR_RED',
      intentos: MAX_INTENTOS,
      codigoError: codigo,
      error: mensaje,
    };
  }

  /**
   * Criterio 6c: recupera el CDR consultando el estado del comprobante.
   * Devuelve null cuando SUNAT no lo tiene (0127) y reenviar es seguro.
   */
  private async recuperarPorConsulta(
    params: SendInvoiceParams,
    fallo: FalloClasificado,
  ): Promise<DespachoResult | null> {
    this.logger.warn(
      `[Incierto] ${params.invoiceId}: consultando estado en lugar de reenviar`,
    );

    try {
      const consulta = await this.soapClient.getStatusCdrLegacy({
        rucComprobante: params.rucEmisor,
        tipoComprobante: params.tipoComprobante,
        serieComprobante: params.serie,
        numeroComprobante: params.correlativo,
        credentials: this.credenciales(params.rucEmisor),
      });

      await registrarAuditoria(
        this.prisma,
        params.invoiceId,
        params.intento ?? 1,
        'EN_COLA',
        'EN_COLA',
        'SOAP_TIMEOUT_RECOVERY',
        `Consulta de estado: ${consulta.statusCode ?? 'sin codigo'} (${consulta.statusMessage ?? ''})`,
        consulta.tiempoRespuestaMs,
      );

      if (consulta.noEncontrado || !consulta.applicationResponse) return null;

      return await this.procesarCdr(
        params,
        consulta.applicationResponse,
        consulta.tiempoRespuestaMs,
        2,
      );
    } catch (error) {
      this.logger.error(
        `Consulta de estado fallida para ${params.invoiceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        invoiceId: params.invoiceId,
        success: false,
        deferred: false,
        status: 'ENVIADO',
        intentos: 1,
        codigoError: fallo.codigo,
        error: 'Estado incierto: la consulta de estado tambien fallo',
      };
    }
  }

  /** Decodifica el CDR, lo persiste y deja el comprobante en estado final. */
  private async procesarCdr(
    params: SendInvoiceParams,
    applicationResponse: string,
    tiempoRespuestaMs: number,
    intento: number,
  ): Promise<DespachoResult> {
    const cdr = parseCdr(applicationResponse);
    const clasificacion = classifyCdr(cdr);

    try {
      await this.persistence.persist({
        invoiceId: params.invoiceId,
        cdr,
        classification: clasificacion,
        tiempoRespuestaMs,
        estadoAnterior: params.estadoActual ?? 'EN_COLA',
        intento,
      });
    } catch (error) {
      this.logger.error(
        `CDR recibido pero no persistido para ${params.invoiceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.marcar(
      params.invoiceId,
      clasificacion.status,
      params.estadoActual ?? 'EN_COLA',
      cdr.responseCode,
      cdr.description ?? clasificacion.kind,
      intento,
      tiempoRespuestaMs,
    );

    this.logger.log(
      `[CDR] ${params.invoiceId}: ${cdr.responseCode} -> ${clasificacion.status}`,
    );

    return {
      invoiceId: params.invoiceId,
      success: true,
      deferred: false,
      status: clasificacion.status,
      intentos: intento,
      codigoError: cdr.responseCode,
    };
  }
}
