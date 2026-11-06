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

/** Resultado de la compuerta: se envía, o no, y por qué. */
export interface DecisionCompuerta {
  /** `null` = se puede enviar; si no, el resultado con el que termina el pipeline. */
  bloqueo: ProcessCdrResult | null;
  /**
   * true solo si la compuerta se omitió por la bandera de demostración.
   *
   * Existe como campo y no como efecto secundario del log porque quien llama
   * debe poder dejarlo escrito en la auditoría del comprobante: una omisión que
   * solo aparece en la consola se pierde cuando el proceso se reinicia.
   */
  omitidaPorDemo: boolean;
  noConcluyente?: boolean;
}

/**
 * Nombre de la bandera que omite la compuerta en la demostración.
 *
 * Se exige activarla a mano y con el valor explícito `true`. No hay ningún
 * valor por defecto permisivo: sin la variable, o con cualquier otro valor, la
 * compuerta se aplica con normalidad.
 */
export const BANDERA_DEMO = 'BYPASS_XSL_GATE_DEMO';

/** Mensaje único del aviso, para que consola y auditoría digan lo mismo. */
export const AVISO_DEMO =
  'Compuerta XSL omitida por bandera explícita de demostración ' +
  `(${BANDERA_DEMO}=true; limitación de xslt-processor con xsl:call-template ` +
  'documentada en specs/DEUDA_VALIDADOR_XSL.md)';

/**
 * ¿Está activa la bandera de demostración?
 *
 * Se lee en cada llamada y no en el constructor: así el valor puede cambiarse
 * entre pruebas y un despliegue que arranca sin la variable no queda con una
 * decisión congelada.
 */
export function bypassDemoActivo(): boolean {
  return (process.env[BANDERA_DEMO] ?? '').trim().toLowerCase() === 'true';
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
  const decision = await decidirEnvio(params, xml, validator, persistence);
  // Este atajo no tiene acceso a las demás comprobaciones ni puede permitir
  // por sí solo un despacho sin el consumidor que las ejecuta y audita.
  if (decision.noConcluyente) {
    throw new ErrorValidacionBloqueada(
      'Requiere comprobaciones y auditoría del consumidor',
      'NO_CONCLUYENTE',
    );
  }
  return decision.bloqueo;
}

/**
 * Compuerta con su decisión completa, incluida la omisión por demostración.
 *
 * Es la que usa el consumidor de la cola, porque necesita saber si hubo
 * omisión para dejarla escrita en la auditoría del comprobante.
 *
 * ORDEN DE LAS COMPROBACIONES, y por qué:
 *
 *  1. La bandera se mira ANTES de invocar al validador. Si se validara primero
 *     y se omitiera después, cada comprobante gastaría el tiempo de ejecutar
 *     una hoja de 500 KB para descartar el resultado.
 *  2. La omisión se registra en la auditoría con `persistFailure` reutilizado,
 *     que es la tabla que ya existe para dejar rastro de cada decisión del
 *     pipeline. Se escribe con el estado actual del comprobante (no se toca) y
 *     sin código de error: la omisión no es un rechazo, es una advertencia.
 *     Inventar un estado nuevo habría exigido una migración del enumerado.
 */
export async function decidirEnvio(
  params: SendInvoiceParams,
  xml: string,
  validator: SunatXslValidatorService,
  persistence: CdrPersistenceService,
): Promise<DecisionCompuerta> {
  if (bypassDemoActivo()) {
    await registrarOmisionDemo(params, persistence);
    return { bloqueo: null, omitidaPorDemo: true };
  }

  const resultado = await validator.validar(xml, params.tipoComprobante);

  if (
    resultado.causaNoConcluyente === 'DEPENDENCIA_VALIDATE_UTILS_AUSENTE' &&
    !resultado.bloqueado && !resultado.valido && !resultado.validadoDeVerdad &&
    resultado.errores.length === 0
  ) {
    return { bloqueo: null, omitidaPorDemo: false, noConcluyente: true };
  }

  if (resultado.bloqueado) {
    throw new ErrorValidacionBloqueada(
      resultado.motivoBloqueo ?? 'Validación XSL no disponible',
      resultado.motivoBloqueo ?? 'SIN_MOTIVO',
    );
  }

  if (resultado.valido) return { bloqueo: null, omitidaPorDemo: false };

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
    bloqueo: {
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
    },
    omitidaPorDemo: false,
  };
}

/**
 * Deja constancia de que la compuerta se omitió.
 *
 * Nunca propaga el error: si la auditoría falla, el envío ya está autorizado
 * por la bandera y detenerlo aquí dejaría el comprobante en un estado peor
 * (en cola, sin motivo visible) que enviarlo con el aviso solo en consola.
 */
async function registrarOmisionDemo(
  params: SendInvoiceParams,
  persistence: CdrPersistenceService,
): Promise<void> {
  try {
    await persistence.persistFailure({
      invoiceId: params.invoiceId,
      // El estado NO cambia: la omisión no es un rechazo ni un envío.
      estadoNuevo: params.estadoActual ?? InvoiceStatus.EN_COLA,
      estadoAnterior: params.estadoActual ?? null,
      intento: params.intento ?? 1,
      codigoError: null,
      mensajeError: `[DEMO] ${AVISO_DEMO}`,
      tiempoRespuestaMs: null,
    });
  } catch {
    // Silencio deliberado: ver el comentario de la función.
  }
}
