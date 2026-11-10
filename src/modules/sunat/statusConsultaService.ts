import { detalleErrorConsulta } from './statusConsultaError';
import { assertCdrReference } from './soap/cdrReferenceGuard';
import { IssuerConfigResolver } from './issuerConfigResolver';
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
import { buildSolUsername, endpointCoherente } from './soap/sunatBillTypes';
import { SunatSoapClient } from './soap/sunat-soap.client';
import { SUNAT_CODE_NO_ENCONTRADO } from './soap/sunatStatusCdrOperation';
import type { ProcessCdrResult } from './soap/sunatBillTypes';

/**
 * Códigos con los que SUNAT confirma que NO tiene el comprobante (TA-58).
 *
 *  - `0127`: "El comprobante no existe en los registros de SUNAT".
 *  - `0011`: "No existe el comprobante informado" en el billConsultService.
 *
 * Ambos son igual de concluyentes para el pipeline: si SUNAT no lo tiene,
 * reenviarlo no puede producir un duplicado, que es lo que TA-32 evita.
 * Tratarlos como cualquier otro código dejaba el comprobante en INCIERTO para
 * siempre y bloqueaba el reintento legítimo.
 */
export const CODIGOS_NO_ENCONTRADO: readonly string[] = [
  SUNAT_CODE_NO_ENCONTRADO,
  '0011',
];

/**
 * ¿SUNAT dice que el comprobante no existe?
 *
 * Se normaliza el código porque llega como texto desde el CDR y SUNAT lo
 * publica sin ceros de relleno en algunas versiones (`127` por `0127`).
 */
function esNoEncontrado(codigo: string | null): boolean {
  if (!codigo) return false;
  const normalizado = codigo.trim().padStart(4, '0');
  return CODIGOS_NO_ENCONTRADO.includes(normalizado);
}

/**
 * ¿El comprobante se puede recuperar con `billConsultService`? (TA-58)
 *
 * El billConsultService resuelve Facturas y sus notas (series F...). Las
 * Boletas viven en el resumen diario, así que preguntar por una serie B
 * devuelve el error `0010` y deja el comprobante en un estado indeterminado
 * inútil: la respuesta no dice nada sobre si existe. Por eso solo se consulta
 * a partir de la serie y, para el resto, se informa INCIERTO con el motivo.
 */
function consultablePorSerie(serie: string): boolean {
  return (
    typeof serie === 'string' && serie.trim().toUpperCase().startsWith('F')
  );
}

/** Datos mínimos para preguntar por un comprobante. */
export interface ConsultaEstadoRequest {
  companyId?: string;
  invoiceId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
}

export type { DesenlaceConciliacion as DesenlaceConsulta } from '../invoices/application/services/invoiceReconciliation';
import type { DesenlaceConciliacion as DesenlaceConsulta } from '../invoices/application/services/invoiceReconciliation';

@Injectable()
export class SunatStatusConsultaService {
  private readonly logger = new Logger(SunatStatusConsultaService.name);

  constructor(
    private readonly persistence: CdrPersistenceService,
    private readonly prisma: PrismaService,
    @Optional() private readonly client?: SunatSoapClient,
    @Optional() private readonly resolver?: IssuerConfigResolver,
  ) {}

  /** Puerto estructurado: recupera la empresa y conserva INCIERTO como resultado. */
  async consultarEstado(
    request: ConsultaEstadoRequest,
  ): Promise<DesenlaceConsulta> {
    return this.consultar(request);
  }

  /**
   * Pregunta a SUNAT por el estado de un comprobante.
   *
   * Nunca lanza: cualquier fallo de red se traduce a `INCIERTO`, porque para
   * el pipeline "no pude consultar" es una respuesta legítima y distinta de
   * "no existe".
   */
  async consultar(request: ConsultaEstadoRequest): Promise<DesenlaceConsulta> {
    // TA-58: solo las series F se pueden preguntar al billConsultService.
    // Consultar una Boleta devuelve 0010 y no informa nada real, asi que se
    // responde INCIERTO sin gastar la llamada. INCIERTO no autoriza a
    // reenviar, que es justo lo que hace falta aqui: una Boleta va por el
    // resumen diario, no por sendBill.
    if (!consultablePorSerie(request.serie)) {
      const motivo =
        `La serie '${request.serie}' no se consulta en billConsultService: ` +
        'solo las series F (Facturas y sus notas) se resuelven por esa via; ' +
        'las Boletas se informan en el resumen diario. Estado sin determinar.';
      this.logger.warn(`[TA-58] ${request.invoiceId}: ${motivo}`);
      return { tipo: 'INCIERTO', motivo };
    }

    let etapa = 'contexto';
    let secrets: string[] = [];
    try {
      const invoice = this.resolver
        ? await this.prisma.invoice.findUnique({
            where: { id: request.invoiceId },
            select: { company_id: true },
          })
        : null;
      const companyId = request.companyId ?? invoice?.company_id;
      if (
        this.resolver &&
        (!companyId || (invoice && invoice.company_id !== companyId))
      )
        throw new Error('ISSUER_COMPANY_REQUIRED');
      const context =
        this.resolver && companyId
          ? await this.resolver.resolve(companyId)
          : undefined;
      secrets = [context?.sol?.username, context?.sol?.password, context?.certificate?.base64, context?.certificate?.password].filter((v): v is string => Boolean(v));
      if (context && context.ruc !== request.rucEmisor)
        throw new Error(`ISSUER_IDENTITY_MISMATCH: RUC del comprobante ${request.rucEmisor}; RUC de la empresa ${context.ruc}. No se puede consultar con otra identidad emisora.`);
      if (context && !endpointCoherente(context.environment, context.consultEndpoint))
        return { tipo: 'INCIERTO', motivo: 'ISSUER_ENDPOINT_ENV_MISMATCH' };
      const cliente =
        this.client ??
        new SunatSoapClient({
          endpoint: context?.endpoint,
          timeoutMs: context?.timeoutMs,
        });

      etapa = 'consulta';
      const respuesta = await cliente.getStatusCdr(
        {
          rucEmisor: request.rucEmisor,
          tipoComprobante: request.tipoComprobante,
          serie: request.serie,
          correlativo: request.correlativo,
          credentials: context
            ? context.sol
            : this.credenciales(request.rucEmisor),
        },
        context ? { endpoint: context.consultEndpoint } : undefined,
      );

      if (esNoEncontrado(respuesta.responseCode)) {
        this.logger.warn(
          `[TA-30] SUNAT no tiene el comprobante ${request.invoiceId} (${respuesta.responseCode}): se puede reenviar`,
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
      const detalle = detalleErrorConsulta(error, secrets);
      const motivo = `La consulta de estado falló: ${detalle.mensaje}`;
      this.logger.error(`[TA-30] ${request.invoiceId} (${etapa}): ${detalle.nombre}: ${detalle.mensaje}`);
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
    assertCdrReference(cdr, request);
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
  private async estadoActual(invoiceId: string): Promise<InvoiceStatus | null> {
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
