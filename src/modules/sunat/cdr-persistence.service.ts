/**
 * Persistencia del CDR: Invoice.cdr_sunat + TransactionHistory.
 *
 * Criterio 3 de TA-03: extraer ID, codigo de respuesta y descripcion y
 * persistirlos en Invoice.cdr_sunat y en TransactionHistory.
 * Criterio 6: registrar tiempo_respuesta_ms por intento.
 *
 * Se guarda ademas el XML crudo del CDR: es la constancia que SUNAT devuelve y
 * el respaldo ante una fiscalizacion. Sin el no se podria demostrar que
 * respondio exactamente el servicio.
 *
 * Todo se escribe en UNA SOLA transaccion: si el estado del comprobante y su
 * traza de auditoria divergen, se pierde la trazabilidad.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus } from '../../generated/prisma/enums';
import { CdrClassification } from './soap/cdr-classifier';
import { ParsedCdr } from './soap/cdr.parser';

export interface PersistCdrParams {
  invoiceId: string;
  cdr: ParsedCdr;
  classification: CdrClassification;
  /** Milisegundos de la llamada SOAP (uno por intento). */
  tiempoRespuestaMs: number;
  /** Estado desde el que se actualiza, para la auditoria del historial. */
  estadoAnterior: InvoiceStatus | null;
  /** Numero de intento del envio. */
  intento: number;
}

@Injectable()
export class CdrPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(params: PersistCdrParams) {
    const {
      invoiceId,
      cdr,
      classification,
      tiempoRespuestaMs,
      estadoAnterior,
      intento,
    } = params;

    // El JSON que se guarda en Invoice.cdr_sunat. El responseCode se conserva
    // como STRING: '0100' no es 100 y '0' no es '0000'.
    const cdrSunat = {
      id: cdr.id,
      responseCode: cdr.responseCode,
      description: cdr.description,
      referenceId: cdr.referenceId,
      // Prisma tipa el JSON con indice de string: se aplana a objetos planos.
      observaciones: cdr.observaciones.map((observacion) => ({
        codigo: observacion.codigo,
        texto: observacion.texto,
      })),
      responseDate: cdr.responseDate,
      responseTime: cdr.responseTime,
      ublVersion: cdr.ublVersion,
      xmlFileName: cdr.xmlFileName,
      clasificacion: classification.kind,
      valido: classification.valido,
      reintentable: classification.reintentable,
      // Constancia devuelta por SUNAT.
      rawXml: cdr.rawXml,
    };

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          estado: classification.status,
          cdr_sunat: cdrSunat,
        },
        select: { id: true, estado: true, updated_at: true },
      });

      const history = await tx.transactionHistory.create({
        data: {
          invoice_id: invoiceId,
          intento,
          estado_anterior: estadoAnterior,
          estado_nuevo: classification.status,
          // El codigo de respuesta del CDR es el "codigo de error" desde el
          // punto de vista del pipeline; en un aceptado es '0'.
          codigo_error: cdr.responseCode,
          mensaje_error:
            cdr.description ?? `CDR con codigo ${cdr.responseCode}`,
          tiempo_respuesta_ms: tiempoRespuestaMs,
        },
        select: {
          id: true,
          estado_nuevo: true,
          codigo_error: true,
          tiempo_respuesta_ms: true,
        },
      });

      return { invoice, history };
    });
  }

  /**
   * Registra un intento fallido cuando SUNAT no devolvio un CDR: timeout,
   * error de red o SOAP Fault.
   *
   * Criterio 5 de TA-03: manejar SOAP Fault y timeout SIN perder el job. El
   * trabajo no se destruye ni se descarta: se deja el estado y el historial
   * para que el backoff reintente o para que un humano lo revise.
   */
  async persistFailure(params: {
    invoiceId: string;
    estadoNuevo: InvoiceStatus;
    estadoAnterior: InvoiceStatus | null;
    intento: number;
    codigoError: string | null;
    mensajeError: string;
    tiempoRespuestaMs: number | null;
  }) {
    const {
      invoiceId,
      estadoNuevo,
      estadoAnterior,
      intento,
      codigoError,
      mensajeError,
      tiempoRespuestaMs,
    } = params;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { estado: estadoNuevo },
        select: { id: true, estado: true, updated_at: true },
      });

      const history = await tx.transactionHistory.create({
        data: {
          invoice_id: invoiceId,
          intento,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoNuevo,
          codigo_error: codigoError,
          mensaje_error: mensajeError,
          tiempo_respuesta_ms: tiempoRespuestaMs,
        },
        select: { id: true, estado_nuevo: true, tiempo_respuesta_ms: true },
      });

      return { invoice, history };
    });
  }
}
