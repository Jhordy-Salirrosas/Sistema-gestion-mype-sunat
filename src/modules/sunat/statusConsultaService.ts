/**
 * Recuperación de un envío que quedó en timeout (TA-30).
 *
 * Criterios del backlog:
 *   1. Usa el consultService por tipo + serie + correlativo.
 *   2. Se activa cuando el envío terminó en timeout: recupera el estado en
 *      lugar de reenviar.
 *   3. Actualiza Invoice.estado y audita el evento como recuperación.
 *
 * La distinción que hace correcto este servicio: "no se pudo consultar" NO es
 * lo mismo que "SUNAT no lo tiene". Solo la segunda autoriza a reenviar. Si la
 * consulta falla por red, el comprobante sigue en estado incierto y el pipeline
 * debe dejarlo quieto (o reintentar la consulta), nunca reenviar a ciegas.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prismaService';
import { InvoiceStatus } from '../../generated/client/enums';
import { CdrPersistenceService } from './cdr-persistence.service';
import { parseCdr } from './soap/cdr.parser';
import { classifyCdr } from './soap/cdr.classifier';
import { buildSolUsername } from './soap/sunatBillTypes';
import {
  SunatSoapClient,
  SunatTransportError,
} from './soap/sunat-soap.client';
import { SUNAT_CODE_NO_ENCONTRADO } from './soap/sunatStatusCdrOperation';
import type { ProcessCdrResult } from './soap/sunatBillTypes';

/** Datos mínimos para preguntar por un comprobante. */
export interface ConsultaEstadoRequest {
  invoiceId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
}

/** Desenlace de una consulta de estado. */
export type DesenlaceConsulta =
  /** SUNAT tenía el comprobante: estado y CDR recuperados. */
  | { tipo: 'RECUPERADO'; resultado: ProcessCdrResult }
  /** SUNAT no lo tiene (0127): reenviar es seguro. */
  | { tipo: 'NO_ENCONTRADO' }
  /** La consulta no fue concluyente: NO reenviar. */
  | { tipo: 'INCIERTO'; motivo: string };

@Injectable()
export class SunatStatusConsultaService {
  private readonly logger = new Logger(SunatStatusConsultaService.name);

  constructor(
    private readonly persistence: CdrPersistenceService,
    private readonly prisma: PrismaService,
    @Optional() private readonly client?: SunatSoapClient,
  ) {}

  /**
   * Pregunta a SUNAT por el estado de un comprobante.
   *
   * Nunca lanza: cualquier fallo de red se traduce a `INCIERTO`, porque para
   * el pipeline "no pude consultar" es una respuesta legítima y distinta de
   * "no existe".
   */
  async consultar(
    request: ConsultaEstadoRequest,
  ): Promise<DesenlaceConsulta> {
    const cliente = this.client ?? new SunatSoapClient();

    try {
      const respuesta = await cliente.getStatusCdr({
        rucEmisor: request.rucEmisor,
        tipoComprobante: request.tipoComprobante,
        serie: request.serie,
        correlativo: request.correlativo,
        credentials: this.credenciales(request.rucEmisor),
      });

      if (respuesta.responseCode === SUNAT_CODE_NO_ENCONTRADO) {
        this.logger.warn(
          `[TA-30] SUNAT no tiene el comprobante ${request.invoiceId} (0127): se puede reenviar`,
        );
        return { tipo: 'NO_ENCONTRADO' };
      }

      if (!respuesta.applicationResponse) {
        return {
          tipo: 'INCIERTO',
          motivo: `SUNAT respondió ${respuesta.responseCode ?? 'sin código'} sin CDR: el estado sigue sin determinarse`,
        };
      }

      return {
        tipo: 'RECUPERADO',
        resultado: await this.persistirRecuperacion(
          request,
          respuesta.applicationResponse,
          respuesta.tiempoRespuestaMs,
        ),
      };
    } catch (error) {
      const motivo =
        error instanceof SunatTransportError
          ? `La consulta de estado falló: ${error.message}`
          : `La consulta de estado falló: ${
              error instanceof Error ? error.message : 'error desconocido'
            }`;

      this.logger.error(`[TA-30] ${request.invoiceId}: ${motivo}`);
      return { tipo: 'INCIERTO', motivo };
    }
  }

  /**
   * Decodifica el CDR recuperado y lo persiste como recuperación (criterio 3).
   *
   * Se reutiliza `CdrPersistenceService` para no duplicar la escritura
   * transaccional (Invoice + TransactionHistory) que ya usa el envío normal.
   */
  private async persistirRecuperacion(
    request: ConsultaEstadoRequest,
    applicationResponse: string,
    tiempoRespuestaMs: number,
  ): Promise<ProcessCdrResult> {
    const cdr = parseCdr(applicationResponse);
    const clasificacion = classifyCdr(cdr);

    const estadoAnterior = await this.estadoActual(request.invoiceId);

    await this.persistence.persist({
      invoiceId: request.invoiceId,
      cdr,
      classification: clasificacion,
      tiempoRespuestaMs,
      estadoAnterior,
      intento: 1,
    });

    await this.auditarRecuperacion(
      request,
      estadoAnterior,
      clasificacion.status,
      cdr.responseCode,
    );

    this.logger.log(
      `[TA-30] ${request.invoiceId} recuperado desde SUNAT con CDR ${cdr.responseCode}: ${clasificacion.status}`,
    );

    return {
      invoiceId: request.invoiceId,
      responseCode: cdr.responseCode,
      estado: clasificacion.status,
      valido: clasificacion.valido,
      reintentable: clasificacion.reintentable,
      clasificacion,
      cdr,
      tiempoRespuestaMs,
      error: null,
    };
  }

  /** Estado actual del comprobante, para la trazabilidad del historial. */
  private async estadoActual(
    invoiceId: string,
  ): Promise<InvoiceStatus | null> {
    const fila = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { estado: true },
    });
    return fila?.estado ?? null;
  }

  /**
   * Deja constancia en AuditLog de que el estado no vino de un envío sino de
   * una consulta de recuperación (criterio 3).
   */
  private async auditarRecuperacion(
    request: ConsultaEstadoRequest,
    estadoAnterior: InvoiceStatus | null,
    estadoNuevo: InvoiceStatus,
    codigoCdr: string,
  ): Promise<void> {
    const comprobante = await this.prisma.invoice.findUnique({
      where: { id: request.invoiceId },
      select: { company_id: true },
    });

    if (!comprobante) return;

    await this.prisma.auditLog.create({
      data: {
        company_id: comprobante.company_id,
        module: 'M1_FACTURACION',
        action: 'RECUPERACION_ESTADO_SUNAT',
        entity_name: 'Invoice',
        entity_id: request.invoiceId,
        ip_address: 'consulta-interna',
        previous_values: { estado: estadoAnterior },
        new_values: {
          estado: estadoNuevo,
          cdr_codigo: codigoCdr,
          origen: 'getStatusCdr',
        },
        digest_hash: `${request.invoiceId}:RECUPERACION:${codigoCdr}`,
      },
    });
  }

  /** Credenciales SOL, igual que en el envío; `null` si no están. */
  private credenciales(rucEmisor: string) {
    const password = process.env.SUNAT_SOL_PASSWORD;
    const username = buildSolUsername(rucEmisor);
    return username && password ? { username, password } : null;
  }
}
