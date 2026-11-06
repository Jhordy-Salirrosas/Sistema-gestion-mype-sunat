import {
  IssuerConfigResolver,
  type IssuerContext,
} from '../../../sunat/issuerConfigResolver';
import { Optional } from '@nestjs/common';
/**
 * Cola del envío de resúmenes diarios y comunicaciones de baja (TA-67).
 *
 * QUÉ FALTABA
 *
 * `sunatSummaryOperations.ts` ya sabe hablar con `sendSummary` y con
 * `getStatus(ticket)`, y `summaryDocumentsBuilder.ts` ya arma los dos XML. Pero
 * nada los encolaba ni los reintentaba: el envío solo existía como dos funciones
 * que había que llamar a mano desde dentro de una petición HTTP. Eso tiene tres
 * consecuencias en producción:
 *
 *  - un timeout de SUNAT pierde el resumen, porque la petición ya terminó;
 *  - el proceso que lo envió puede reiniciarse a mitad y no queda quién espere
 *    el ticket;
 *  - y `getStatus` devuelve **98 o 99** ("en proceso") mientras SUNAT trabaja,
 *    que NO es un error: hay que volver a preguntar más tarde.
 *
 * POR QUÉ UNA COLA PROPIA Y NO LA DE COMPROBANTES
 *
 * La cola `sunat-invoice-queue` está atada al comprobante: su payload es
 * `{ invoice_id }` y su consumidor relee la fila, la firma y la empaqueta. Un
 * resumen no es un comprobante: tiene su propio XML, su propio identificador
 * (RC-AAAAMMDD-NNN) y NO espera CDR inmediato, sino un ticket. Meterlo en la
 * misma cola obligaría a que el consumidor de facturas preguntara "¿esto es un
 * comprobante o un resumen?" en cada job, que es exactamente el tipo de
 * bifurcación que termina tratando un 98 como un rechazo.
 *
 * LA SECUENCIA, EN UNA SOLA TAREA LÓGICA
 *
 *   1. `sendSummary` -> ticket
 *   2. `getStatus(ticket)`:
 *        - 98/99 -> esperar `esperaMs` y volver al paso 2, sin gastar envío;
 *        - con contenido -> listo, hay CDR;
 *        - código distinto -> SUNAT respondió; se devuelve tal cual.
 *
 * El bucle de sondeo vive DENTRO de este servicio y no en la cola: si cada
 * consulta a `getStatus` fuera un job distinto, un resumen en proceso generaría
 * decenas de jobs y el movimiento a la DLQ dejaría de ser un criterio claro.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  CODIGOS_EN_PROCESO,
  SunatSummaryClient,
  parseGetStatusResponse,
  type CredencialesSol,
  type GetStatusResult,
} from '../../../sunat/soap/sunatSummaryOperations';
// `QueueService` se importa como VALOR y no con `import type`: Nest resuelve las
// dependencias del constructor por el metatipo que emite TypeScript, y
// `import type` lo borra al compilar. Sin el valor, el contenedor no sabe qué
// inyectar y el arranque falla con "can't resolve dependencies at index [0]".
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';

/** Tipo de documento que viaja en esta cola. */
export type TipoEnvioResumen = 'RESUMEN_DIARIO' | 'COMUNICACION_BAJA';

/** Payload del job: identifica qué enviar y con qué credenciales. */
export interface SummaryJobData {
  tipo: TipoEnvioResumen;
  /** Identificador del envío: RC-AAAAMMDD-NNN o RA-AAAAMMDD-NNN. */
  identificador: string;
  /** ZIP del XML ya firmado, en Base64 (pg-boss transporta JSON). */
  zipBase64: string;
  /** Nombre del archivo dentro del ZIP. */
  fileName: string;
  /** Empresa dueña del envío, para el aislamiento por tenant. */
  companyId: string;
}

/** Resultado final del envío. Nunca lanza: informa. */
export interface ResultadoEnvioResumen {
  enviado: boolean;
  identificador: string;
  /** Ticket de SUNAT, si `sendSummary` llegó a responder. */
  ticket: string | null;
  /** Código del CDR cuando ya está listo; 98/99 mientras SUNAT procesa. */
  status: string | null;
  /** Contenido del CDR en Base64, cuando SUNAT terminó. */
  contenido: string | null;
  /** Cuántas veces se preguntó por el ticket. */
  consultas: number;
  /** Motivo legible cuando no se pudo completar. */
  error: string | null;
}

/** Opciones del envío con sondeo. */
export interface OpcionesEnvio {
  /** Credenciales SOL del emisor. */
  credentials?: CredencialesSol | null;
  /** Sondeos máximos antes de rendirse. 0 = preguntar una sola vez. */
  maxConsultas?: number;
  /** Espera entre sondeos. */
  esperaMs?: number;
}

/** Nombre de la cola. */
export const SUMMARY_QUEUE = 'sunat-summary-queue';

/** Sondeos por defecto: con 1 s de espera cubre ~30 s de proceso de SUNAT. */
export const CONSULTAS_POR_DEFECTO = 30;

/** Espera por defecto entre sondeos. */
export const ESPERA_POR_DEFECTO_MS = 1000;

/** ¿El código recibido significa "SUNAT todavía está procesando"? */
export const estaEnProceso = (status: string | null): boolean =>
  status !== null && CODIGOS_EN_PROCESO.includes(status);

@Injectable()
export class SummaryDispatchService {
  private readonly logger = new Logger(SummaryDispatchService.name);

  constructor(
    private readonly cola: QueueService,
    private readonly cliente: SunatSummaryClient,
    @Optional() private readonly issuerConfig?: IssuerConfigResolver,
  ) {}

  /**
   * Encola el envío del resumen o de la baja.
   *
   * Se encola el ZIP ya armado y firmado, no los datos sueltos: así el job es
   * inmutable (reintentarlo no puede generar un documento distinto) y el
   * consumidor no necesita saber cómo se construye el XML.
   */
  async encolar(
    job: SummaryJobData,
    opciones: OpcionesEnvio = {},
  ): Promise<string | null> {
    return this.cola.encolarResumen({
      ...job,
      maxConsultas: opciones.maxConsultas ?? CONSULTAS_POR_DEFECTO,
      esperaMs: opciones.esperaMs ?? ESPERA_POR_DEFECTO_MS,
    });
  }

  /**
   * Ejecuta el envío completo: `sendSummary` y luego sondeo del ticket.
   *
   * Nunca lanza. Un fallo de red se devuelve como `enviado: false` con su
   * motivo, para que el consumidor decida si reintenta; lanzar aquí haría que
   * pg-boss aplicara su propio reintento y el backoff dejaría de depender de
   * una sola política.
   */
  async procesar(
    job: SummaryJobData,
    opciones: OpcionesEnvio = {},
  ): Promise<ResultadoEnvioResumen> {
    const base: ResultadoEnvioResumen = {
      enviado: false,
      identificador: job.identificador,
      ticket: null,
      status: null,
      contenido: null,
      consultas: 0,
      error: null,
    };

    if (!job.zipBase64) {
      return { ...base, error: 'El job no trae el ZIP del resumen' };
    }

    const context = await this.issuerConfig?.resolve(job.companyId);
    if (context && !job.fileName.startsWith(context.ruc + '-'))
      throw new Error('ISSUER_IDENTITY_MISMATCH');
    let ticket: string | null;
    try {
      const envio = await this.cliente.sendSummary({
        fileName: job.fileName,
        zip: Buffer.from(job.zipBase64, 'base64'),
        credentials: context
          ? context.sol
            ? { usuario: context.sol.username, clave: context.sol.password }
            : null
          : (opciones.credentials ?? null),
        context,
      });
      ticket = envio.ticket;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[TA-67] ${job.identificador}: sendSummary falló (${motivo})`,
      );
      return { ...base, error: motivo };
    }

    if (!ticket) {
      // Sin ticket no hay nada que consultar. Se distingue de un fallo de red
      // porque reintentar no lo arregla: SUNAT no aceptó el envío.
      const motivo = 'sendSummary no devolvió ticket';
      this.logger.error(`[TA-67] ${job.identificador}: ${motivo}`);
      return { ...base, error: motivo };
    }

    const sondeo = await this.sondear(ticket, opciones, context);
    const resultado: ResultadoEnvioResumen = {
      ...base,
      enviado: sondeo.contenido !== null,
      ticket,
      status: sondeo.status,
      contenido: sondeo.contenido,
      consultas: sondeo.consultas,
      error: sondeo.error,
    };

    // Un 98/99 al agotar los sondeos NO es un rechazo: es "sigue procesando".
    // Se deja dicho con todas sus letras para que nadie lo lea como error.
    if (!resultado.enviado && estaEnProceso(resultado.status)) {
      resultado.error = `SUNAT sigue procesando (código ${resultado.status}) tras ${resultado.consultas} consulta(s): reintentar más tarde`;
    }

    this.logger.log(
      `[TA-67] ${job.identificador}: ticket ${ticket}, estado ${resultado.status ?? 'sin respuesta'}, ` +
        `${resultado.consultas} consulta(s), CDR ${resultado.enviado ? 'obtenido' : 'pendiente'}`,
    );

    return resultado;
  }

  /**
   * Pregunta por el ticket hasta obtener el CDR o agotar los intentos.
   *
   * El último resultado se conserva aunque esté en proceso: quien llama
   * necesita saber si SUNAT dijo "98" o simplemente no contestó.
   */
  private async sondear(
    ticket: string,
    opciones: OpcionesEnvio,
    context?: IssuerContext,
  ): Promise<{
    status: string | null;
    contenido: string | null;
    consultas: number;
    error: string | null;
  }> {
    const maximo = Math.max(0, opciones.maxConsultas ?? CONSULTAS_POR_DEFECTO);
    const espera = Math.max(0, opciones.esperaMs ?? ESPERA_POR_DEFECTO_MS);

    let consultas = 0;
    let ultimo: GetStatusResult | null = null;

    // `maximo + 1` porque el primer sondeo siempre se hace (incluso con 0), y
    // los siguientes esperan: esperar antes de preguntar la primera vez
    // retrasaría inútilmente un resumen que suele estar listo de inmediato.
    for (let i = 0; i <= maximo; i += 1) {
      if (i > 0 && espera > 0) {
        await this.dormir(espera);
      }

      try {
        ultimo = await this.cliente.getStatus(
          ticket,
          context
            ? context.sol
              ? { usuario: context.sol.username, clave: context.sol.password }
              : null
            : (opciones.credentials ?? null),
          context,
        );
      } catch (error) {
        return {
          status: ultimo?.statusCode ?? null,
          contenido: null,
          consultas,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      consultas += 1;

      if (ultimo.contenido) {
        return {
          status: ultimo.statusCode,
          contenido: ultimo.contenido,
          consultas,
          error: null,
        };
      }

      if (!ultimo.enProceso) {
        // SUNAT respondió algo que no es 98/99 y sin contenido: es un resultado
        // final (rechazo del resumen) y volver a preguntar no lo cambia.
        return {
          status: ultimo.statusCode,
          contenido: null,
          consultas,
          error: ultimo.statusCode
            ? `SUNAT respondió ${ultimo.statusCode} sin CDR`
            : 'SUNAT no devolvió estado ni contenido',
        };
      }
    }

    return {
      status: ultimo?.statusCode ?? null,
      contenido: null,
      consultas,
      error: null,
    };
  }

  /** Espera sin bloquear el bucle de eventos. */
  private dormir(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Interpreta la respuesta cruda de `getStatus` desde el consumidor.
 *
 * Se exporta como función pura para poder probar el parseo sin levantar red:
 * es la pieza donde vive la distinción entre "en proceso" y "rechazado", y
 * equivocarla es exactamente el defecto que este ticket evita.
 */
export function interpretarEstadoResumen(xml: string): {
  status: string | null;
  enProceso: boolean;
  contenido: string | null;
} {
  const parseado = parseGetStatusResponse(xml);
  return {
    status: parseado.statusCode,
    enProceso: parseado.enProceso,
    contenido: parseado.contenido,
  };
}
