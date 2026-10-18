import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../../generated/client/enums';
import { CdrPersistenceService } from '../cdr-persistence.service';
import { classifyCdr } from './cdr.classifier';
import { CdrClassification, classifyResponseCode } from './cdr-classifier';
import { CdrDecodeError, EMPTY_PARSED_CDR } from './cdr.parser';
import {
  isSunatSoapFaultError,
  isSunatTransportError,
} from './sunat-soap.client';
import { ProcessCdrResult, SendInvoiceParams } from './sunatBillTypes';

export async function handleSunatBillError(
  params: SendInvoiceParams,
  error: unknown,
  persistence: CdrPersistenceService,
  logger: Logger,
): Promise<ProcessCdrResult> {
  if (isSunatSoapFaultError(error)) {
    const codigo = error.sunatCode ?? '';
    const clasificacion = classifyResponseCode(codigo);
    logger.warn(`SOAP Fault al enviar ${params.invoiceId}: ${error.message}`);

    return failure(
      params,
      error.message,
      clasificacion.status,
      codigo,
      clasificacion,
      clasificacion.reintentable,
      persistence,
      logger,
    );
  }

  if (error instanceof CdrDecodeError) {
    return failure(
      params,
      `No se pudo decodificar el CDR: ${error.message}`,
      InvoiceStatus.ERROR_RED,
      null,
      null,
      true,
      persistence,
      logger,
    );
  }

  if (isSunatTransportError(error)) {
    return failure(
      params,
      `${error.message}. Conciliar con billConsultService antes de reenviar`,
      InvoiceStatus.ENVIADO,
      null,
      null,
      true,
      persistence,
      logger,
    );
  }

  const mensaje = error instanceof Error ? error.message : 'Error desconocido';
  logger.error(`Fallo al enviar ${params.invoiceId} al billService: ${mensaje}`);

  return failure(
    params,
    mensaje,
    InvoiceStatus.ERROR_RED,
    null,
    null,
    true,
    persistence,
    logger,
  );
}

async function failure(
  params: SendInvoiceParams,
  mensaje: string,
  estado: InvoiceStatus,
  responseCode: string | null,
  clasificacion: CdrClassification | null,
  reintentable: boolean,
  persistence: CdrPersistenceService,
  logger: Logger,
  tiempoRespuestaMs: number | null = null,
): Promise<ProcessCdrResult> {
  try {
    await persistence.persistFailure({
      invoiceId: params.invoiceId,
      estadoNuevo: estado,
      estadoAnterior: params.estadoActual ?? null,
      intento: params.intento ?? 1,
      codigoError: responseCode,
      mensajeError: mensaje,
      tiempoRespuestaMs,
    });
  } catch (err) {
    logger.error(
      `No se pudo auditar el fallo de ${params.invoiceId}: ${
        err instanceof Error ? err.message : 'error desconocido'
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
