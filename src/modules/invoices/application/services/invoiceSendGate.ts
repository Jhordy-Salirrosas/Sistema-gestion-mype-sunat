/**
 * Puerta de validación previa al envío (TA-31, criterio 4).
 *
 * El criterio es tajante: "si hay un ERROR, el envío se bloquea sin consumir
 * intentos del backoff". Por eso la validación NO vive dentro del intento de
 * envío (donde gastaría un intento), sino antes del bucle de reintentos.
 *
 * Vocabulario de estados usado aquí:
 *   - Bloqueo por datos inválidos  -> el comprobante queda como RECHAZADO.
 *     No es un problema de red: reintentar el mismo XML repetiría el error,
 *     así que no va a la DLQ ni cuenta como intento.
 *   - Bloqueo por falta de XSL     -> se lanza `ErrorValidacionBloqueada`.
 *     Es un problema de infraestructura (falta un archivo), no del
 *     comprobante: el job debe permanecer en cola hasta que se corrija.
 */
import { InvoiceStatus } from '../../../../generated/client/enums';
import { CdrPersistenceService } from '../../../sunat/cdr-persistence.service';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../../../sunat/soap/sunatBillTypes';
import type { SunatXslValidatorService } from './sunatXslValidatorService';

/**
 * El envío no se puede validar: falta la hoja oficial o falló su ejecución.
 *
 * Se distingue de un comprobante inválido a propósito. Quien la capture debe
 * devolver el job a la cola, no marcarlo como rechazado.
 */
export class ErrorValidacionBloqueada extends Error {
  /** true: el comprobante no se envió y el intento NO se consumió. */
  readonly reintentableSinConsumirIntento = true;

  constructor(
    message: string,
    readonly motivo: string,
  ) {
    super(message);
    this.name = 'ErrorValidacionBloqueada';
  }
}

/**
 * Ejecuta la validación XSL antes del primer envío.
 *
 * @returns `null` si el XML es válido y se puede enviar; si el comprobante
 *   está mal emitido, el `ProcessCdrResult` con el que termina el pipeline.
 * @throws ErrorValidacionBloqueada si no hay forma de validar.
 */
export async function validarAntesDeEnviar(
  params: SendInvoiceParams,
  xml: string,
  validator: SunatXslValidatorService,
  persistence: CdrPersistenceService,
): Promise<ProcessCdrResult | null> {
  const resultado = await validator.validar(xml, params.tipoComprobante);

  if (resultado.bloqueado) {
    throw new ErrorValidacionBloqueada(
      resultado.motivoBloqueo ?? 'Validación XSL no disponible',
      resultado.motivoBloqueo ?? 'SIN_MOTIVO',
    );
  }

  if (resultado.valido) return null;

  const detalle = resultado.errores
    .map((error) => `${error.codigo}: ${error.mensaje}`)
    .join(' | ');

  // El comprobante no se envía, así que no hay CDR: se registra el fallo con
  // el código de la primera regla incumplida para que la auditoría diga qué
  // corregir.
  await persistence.persistFailure({
    invoiceId: params.invoiceId,
    estadoNuevo: InvoiceStatus.RECHAZADO,
    estadoAnterior: params.estadoActual ?? null,
    intento: params.intento ?? 1,
    codigoError: resultado.errores[0]?.codigo ?? null,
    mensajeError: `Bloqueado antes de enviar por la validación XSL: ${detalle}`,
    tiempoRespuestaMs: null,
  });

  return {
    invoiceId: params.invoiceId,
    responseCode: resultado.errores[0]?.codigo ?? '',
    estado: InvoiceStatus.RECHAZADO,
    valido: false,
    // false = no alimenta el backoff ni la DLQ: el XML está mal, no la red.
    reintentable: false,
    clasificacion: {
      status: InvoiceStatus.RECHAZADO,
      kind: 'RECHAZADO',
      valido: false,
      reintentable: false,
    },
    cdr: null,
    tiempoRespuestaMs: null,
    error: `Validación XSL local: ${detalle}`,
  };
}
