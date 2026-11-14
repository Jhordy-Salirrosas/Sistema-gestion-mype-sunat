import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PgBoss, fromPrisma } from 'pg-boss';

export const INVOICE_QUEUE = 'sunat-invoice-queue';
export const INVOICE_DLQ = 'sunat-invoice-dlq';
/**
 * TA-67: cola de resúmenes diarios y comunicaciones de baja.
 *
 * Es una cola aparte de la de comprobantes a propósito. Un resumen no espera
 * CDR de inmediato sino un ticket que hay que sondear, y su payload no es
 * `{ invoice_id }`. Compartir cola obligaría al consumidor de facturas a
 * distinguir dos flujos en cada job.
 */
export const SUMMARY_QUEUE = 'sunat-summary-queue';
/** Cola de muertos propia: un resumen atascado no debe mezclarse con facturas. */
export const SUMMARY_DLQ = 'sunat-summary-dlq';
export const SIRE_PERIODS_QUEUE = 'sunat-sire-periods-queue';
export const SIRE_PERIODS_DLQ = 'sunat-sire-periods-dlq';

/** Payload que viaja en la cola de resúmenes. */
export interface SummaryJobData {
  tipo: 'RESUMEN_DIARIO' | 'COMUNICACION_BAJA';
  identificador: string;
  zipBase64: string;
  fileName: string;
  companyId: string;
  maxConsultas?: number;
  esperaMs?: number;
}

export interface TxClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  invoice?: {
    findUnique: (args: {
      where: { id: string };
      select: { company_id: true };
    }) => Promise<{ company_id: string } | null>;
  };
}

/** Payload del job que viaja en la cola: solo identifica el comprobante. */
export interface InvoiceJobData {
  invoice_id: string;
}

export interface SirePeriodsJobData {
  messageId: string;
  companyId: string;
  ruc: string;
  bookCode: '140000' | '080000';
  encryptedSolCredentials: string;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly boss: PgBoss;
  /**
   * Sin base de colas. Se activa cuando `boss.start()` falla y el servicio
   * decide seguir para desarrollo.
   *
   * SIN ESTO EL PROCESO MUERE: los consumidores
   * (`SummaryJobConsumer`, `InvoiceJobConsumer`) se inicializan DESPUÉS que
   * este servicio y llaman a `register*Worker`. Con pg-boss ya detenido, esa
   * llamada lanzaba "Workers are disabled. pg-boss is stopped" en mitad del
   * arranque y Node terminaba el proceso.
   */
  private bypass = false;

  constructor() {
    const databaseUrl = process.env.PG_BOSS_URL || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'La variable DATABASE_URL o PG_BOSS_URL no está configurada',
      );
    }

    this.boss = new PgBoss(databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    /**
     * Sin este listener, un fallo de conexión posterior TUMBA EL PROCESO.
     *
     * pg-boss emite `error` de forma asíncrona cuando su worker pierde la
     * conexión. En modo bypass el `catch` de abajo se traga el fallo del
     * `start()`, pero los workers ya registrados siguen vivos y, al agotar su
     * timeout, emiten un `error` que nadie escucha: Node lo convierte en
     * excepción no capturada y el backend muere con ERR_UNHANDLED_ERROR.
     *
     * Comprobado el 4 nov: `node dist/main.js` arrancaba, respondía `/health`
     * durante unos segundos y se caía solo. Ese error se ve en el log como
     * "Connection terminated due to connection timeout (Queue: sunat-invoice-queue)".
     */
    this.boss.on('error', (error: Error) => {
      this.logger.error(`PgBoss emitió un error de conexión: ${error.message}`);
    });

    try {
      await this.boss.start();

      await this.boss.createQueue(INVOICE_DLQ);
      // Los reintentos SOAP (5/15/45 s) siguen dentro de InvoiceRetryService;
      // pg-boss recupera únicamente los fallos que el consumidor relanza.
      // Excepción autorizada M1 auditoría 2: errores de preparación, circuito
      // abierto y contabilidad se relanzan; el backoff SOAP sigue en su orquestador.
      const invoicePolicy = { retryLimit: 3, retryDelay: 60, retryBackoff: true, retryDelayMax: 300, deadLetter: INVOICE_DLQ };
      await this.boss.createQueue(INVOICE_QUEUE, invoicePolicy);
      await this.boss.updateQueue(INVOICE_QUEUE, invoicePolicy);

      // TA-67: la cola de resúmenes se declara con su propia DLQ. Aquí SÍ se
      // deja un `retryLimit` > 0, al contrario que en la cola de comprobantes:
      // un fallo de red al enviar un resumen no tiene un orquestador propio con
      // backoff (no hay `InvoiceRetryService` para resúmenes), y perder un
      // resumen diario deja el día sin informar a SUNAT.
      await this.boss.createQueue(SUMMARY_DLQ);
      await this.boss.createQueue(SUMMARY_QUEUE, {
        retryLimit: 3,
        deadLetter: SUMMARY_DLQ,
      });

      this.logger.log(
        `Inicializando colas SIRE: ${SIRE_PERIODS_QUEUE} y ${SIRE_PERIODS_DLQ}`,
      );
      await this.boss.createQueue(SIRE_PERIODS_DLQ, { retryLimit: 0 });
      await this.boss.createQueue(SIRE_PERIODS_QUEUE, {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
        retryDelayMax: 300,
        deadLetter: SIRE_PERIODS_DLQ,
      });
      this.logger.log(
        `Colas SIRE inicializadas: ${SIRE_PERIODS_QUEUE} y ${SIRE_PERIODS_DLQ}`,
      );

      this.logger.log('Servicio de colas PgBoss iniciado correctamente');
    } catch (error) {
      this.logger.warn(
        `No se pudo conectar con PgBoss (${(error as Error).message}). El backend iniciará en modo bypass para desarrollo.`,
      );

      // Se apaga lo que haya quedado a medio conectar. Sin esto, el cliente
      // sigue intentando reconectar en segundo plano y su worker emite un
      // `error` más tarde; aunque ya hay listener, el modo bypass debe ser un
      // bypass de verdad y no un cliente zombi.
      await this.boss.stop({ graceful: false }).catch(() => undefined);
      this.bypass = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.boss.stop();
    } catch {
      // Ignorar errores al apagar el servicio si no estaba activo
    }
  }

  /**
   * Encola el procesamiento del comprobante utilizando
   * la misma transacción de Prisma.
   */
  async enqueueInvoiceInTx(
    tx: TxClient,
    invoiceId: string,
  ): Promise<string | null> {
    if (!tx.invoice?.findUnique) {
      throw new Error(
        'El cliente transaccional no permite obtener la empresa.',
      );
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { company_id: true },
    });
    if (!invoice) {
      throw new Error(`No existe el comprobante ${invoiceId} para encolarlo.`);
    }

    const db = fromPrisma(tx);

    return this.boss.send(
      INVOICE_QUEUE,
      { invoice_id: invoiceId, company_id: invoice.company_id },
      { db },
    );
  }

  /** Lectura aditiva: queued:true de PgBoss excluye active y no prueba ausencia de trabajo vivo. */
  async hasLiveInvoiceJob(invoiceId: string): Promise<boolean> {
    const jobs = await this.boss.findJobs(INVOICE_QUEUE, { data: { invoice_id: invoiceId } });
    return jobs.some(job => ['created', 'retry', 'active'].includes(job.state));
  }

  /**
   * Reencola un comprobante varado solo si no tiene un job vivo.
   *
   * La unicidad la garantiza `singletonKey`: pg-boss rechaza un segundo job
   * con la misma clave mientras el primero siga en la cola. La comprobación
   * previa de cola y DLQ solo evita ruido; la carrera entre dos instancias la
   * resuelve la base de datos, no esta función.
   *
   * El callback `estadoPermitido` lo aporta M1: M2 no conoce los estados
   * fiscales y no debe decidir si una factura ya fue aceptada.
   */
  async reenqueueInvoiceIfIdle(
    invoiceId: string,
    companyId: string,
    estadoPermitido?: () => Promise<boolean>,
    opciones: { rescatarDlq?: boolean } = {},
  ): Promise<{
    estado: 'ENCOLADO' | 'YA_EN_COLA' | 'EN_DLQ' | 'ESTADO_NO_PERMITIDO';
    jobId?: string;
  }> {
    if (!invoiceId || !companyId) throw new Error('invoiceId y companyId son obligatorios para reencolar.');
    const vivos = await this.boss.findJobs(INVOICE_QUEUE, { data: { invoice_id: invoiceId }, queued: true });
    if (vivos.length > 0 && !opciones.rescatarDlq) return { estado: 'YA_EN_COLA' };
    const enDlq = await this.boss.findJobs<{ invoice_id?: string; company_id?: string }>(INVOICE_DLQ, { data: { invoice_id: invoiceId }, queued: true });
    if (enDlq.length > 0 && (!opciones.rescatarDlq || enDlq.some(job => job.data?.company_id !== companyId))) return { estado: 'EN_DLQ' };
    if (enDlq.length > 0 && opciones.rescatarDlq && !estadoPermitido) return { estado: 'ESTADO_NO_PERMITIDO' };
    // La comprobación M1 también persiste incertidumbre antes de publicar un rescate.
    if (estadoPermitido && !(await estadoPermitido())) return { estado: 'ESTADO_NO_PERMITIDO' };
    if (vivos.length > 0) {
      // Recupera una limpieza fallida después de una publicación anterior, sin duplicar.
      if (enDlq.length > 0) await this.boss.deleteJob(INVOICE_DLQ, enDlq.map(job => job.id));
      return { estado: 'YA_EN_COLA' };
    }
    const jobId = await this.boss.send(INVOICE_QUEUE, { invoice_id: invoiceId, company_id: companyId }, { singletonKey: `invoice:${invoiceId}` });
    if (enDlq.length > 0) {
      const publicado = jobId || (await this.boss.findJobs(INVOICE_QUEUE, { data: { invoice_id: invoiceId }, queued: true })).length > 0;
      // Publicar primero. Sin publicación comprobada se conserva la DLQ.
      if (!publicado) return { estado: 'EN_DLQ' };
      await this.boss.deleteJob(INVOICE_DLQ, enDlq.map(job => job.id));
    }
    return jobId ? { estado: 'ENCOLADO', jobId } : { estado: 'YA_EN_COLA' };
  }

  /**
   * Cuantos trabajos esperan en la cola principal.
   * Mantiene el conteo operativo de la cola para las tareas internas.
   */
  async countQueued(): Promise<number> {
    const jobs = await this.boss.findJobs(INVOICE_QUEUE);
    return jobs.length;
  }

  /**
   * Trabajos que agotaron los reintentos y cayeron a la cola de muertos.
   *
   * Los jobs nuevos incluyen el company_id para filtrar resultados en la capa
   * de pg-boss, antes de devolverlos al controlador.
   */
  async listDlq(companyId: string): Promise<Array<Record<string, unknown>>> {
    const jobs = await this.boss.findJobs<{
      invoice_id?: string;
      company_id?: string;
      intento?: number;
      codigo_error?: string;
      mensaje_error?: string;
      estado?: string;
    }>(INVOICE_DLQ, { data: { company_id: companyId }, queued: true });

    return jobs
      .filter((job) => job.data?.company_id === companyId)
      .map((job) => ({
        id: job.id,
        comprobanteSerieNumero: job.data?.invoice_id ?? 'sin identificar',
        clienteRuc: '',
        monto: 0,
        codigoErrorSunat: job.data?.codigo_error ?? '',
        mensajeError:
          job.data?.mensaje_error ??
          'El comprobante agotó los reintentos automáticos',
        intentosFallidos: job.data?.intento ?? job.retryCount ?? 0,
        estado: job.data?.estado ?? 'ERROR_RED',
        fechaUltimoIntento: new Date().toISOString(),
      }));
  }

  /**
   * Cuántos trabajos de la empresa están esperando en la cola de muertos.
   *
   * Lo consume la barra de métricas del M1 (TA-69): `pendientes` cuenta los
   * comprobantes con error de red, pero un comprobante que agotó los reintentos
   * y está en la DLQ figura igual como pendiente y el operador no se entera de
   * que necesita intervención manual. Se reutiliza `listDlq` en vez de contar
   * en la tabla de pg-boss para no duplicar el filtro por `company_id`.
   */
  async countDlq(companyId: string): Promise<number> {
    const jobs = await this.listDlq(companyId);
    return jobs.length;
  }

  /**
   * Trabajos de la DLQ cuyo comprobante YA NO EXISTE en la base.
   *
   * POR QUÉ HACE FALTA
   *
   * `listDlq` devuelve todos los jobs de la cola de muertos con el
   * `invoice_id` guardado en el payload, sin comprobar que ese comprobante
   * siga existiendo. Al borrar comprobantes de prueba (repoblados, documentos
   * con datos inválidos) los jobs quedaron huérfanos: el Monitor mostraba
   * "DLQ 3" y la tabla de la DLQ salía vacía, porque la pantalla resuelve el
   * número fiscal y no lo encontraba.
   *
   * Un job huérfano no es trabajo pendiente: reintentarlo lo mueve a la cola
   * principal, el consumidor intenta cargar el comprobante, falla y vuelve a
   * caer en la DLQ. Se informa aparte para que el número grande siga siendo el
   * trabajo real y el operador no persiga fantasmas.
   */
  async countDlqHuerfanos(companyId: string): Promise<number> {
    const jobs = await this.listDlq(companyId);
    const ids = jobs
      .map((job) => job.comprobanteSerieNumero)
      .filter(
        (id): id is string =>
          typeof id === 'string' && id !== 'sin identificar',
      );

    if (ids.length === 0) return 0;

    // Se consulta con SQL directo porque `QueueService` no inyecta Prisma a
    // propósito: solo habla con pg-boss. Una consulta de existencia no
    // justifica introducir la dependencia.
    const vivos = await this.boss
      .getDb()
      .executeSql('SELECT id FROM invoices WHERE id = ANY($1::text[])', [ids]);

    const existentes = new Set(
      (Array.isArray(vivos.rows) ? vivos.rows : []).map((fila) =>
        String((fila as Record<string, unknown>).id),
      ),
    );

    return ids.filter((id) => !existentes.has(id)).length;
  }

  /**
   * Mueve explícitamente un comprobante a la DLQ.
   *
   * Lo usa `InvoiceRetryService` al agotar los 3 reintentos de HU-04. Se crea
   * un job nuevo en la cola de muertos (con `retryLimit: 0` para que no vuelva
   * a ejecutarse solo) y se conserva el motivo y el número de intento para que
   * el panel de la DLQ pueda mostrarlos.
   */
  async sendToDlq(
    invoiceId: string,
    companyId: string,
    detalle: Record<string, unknown> = {},
  ): Promise<string | null> {
    return this.boss.send(
      INVOICE_DLQ,
      { invoice_id: invoiceId, company_id: companyId, ...detalle },
      { retryLimit: 0 },
    );
  }

  /** Retira únicamente trabajos DLQ pendientes; el llamador valida el CDR aceptado. */
  async resolveAcceptedInvoiceDlq(invoiceId: string, companyId: string): Promise<number> {
    const jobs = await this.boss.findJobs<{ invoice_id?: string; company_id?: string }>(
      INVOICE_DLQ, { data: { invoice_id: invoiceId, company_id: companyId }, queued: true },
    );
    const ids = jobs.filter(job => job.data?.invoice_id === invoiceId && job.data?.company_id === companyId)
      .map(job => job.id);
    if (ids.length) await this.boss.deleteJob(INVOICE_DLQ, ids);
    return ids.length;
  }

  /** Devuelve un trabajo propio de la empresa autenticada a la cola principal. */
  async retryDlq(id: string, companyId: string): Promise<void> {
    const [job] = await this.boss.findJobs<{ company_id?: string; invoice_id?: string }>(
      INVOICE_DLQ,
      { id, queued: true },
    );
    if (!job || job.data?.company_id !== companyId) {
      throw new NotFoundException('No se encontró el trabajo de DLQ.');
    }

    if (!job.data.invoice_id) throw new NotFoundException('Trabajo de DLQ sin comprobante recuperable.');
    // Publicar primero: un fallo deja la DLQ recuperable. singleton evita que
    // reintentar tras un fallo de limpieza produzca dos trabajos vivos.
    await this.boss.send(INVOICE_QUEUE, { invoice_id: job.data.invoice_id, company_id: companyId },
      { singletonKey: `invoice:${job.data.invoice_id}` });
    await this.boss.deleteJob(INVOICE_DLQ, id);
  }

  /**
   * TA-28 (criterio 1): registra el consumidor de la cola de facturas.
   *
   * Con `teamSize: 1` y `batchSize: 1` se procesa un comprobante por vez: el
   * pipeline fiscal no debe paralelizarse porque comparte el correlativo y el
   * estado del Circuit Breaker.
   *
   * pg-boss entrega el job con `data = { invoice_id }`; el handler recibe
   * directamente ese payload.
   */
  async registerInvoiceWorker(
    handler: (job: InvoiceJobData) => Promise<unknown>,
  ): Promise<string> {
    // En modo bypass no hay base de colas: se devuelve un identificador vacío
    // en lugar de dejar que pg-boss lance "Workers are disabled".
    if (this.bypass) return '';

    this.logger.log(
      `Registrando worker de comprobantes en la cola ${INVOICE_QUEUE}`,
    );

    return this.boss.work<InvoiceJobData>(
      INVOICE_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        const job = jobs[0];
        if (!job) return;

        this.logger.log(`[Job recibido] Comprobante: ${job.data.invoice_id}`);
        await handler(job.data);
      },
    );
  }

  /**
   * TA-28 (criterio 4): mueve un job agotado a la DLQ.
   *
   * pg-boss ya declara `deadLetter: INVOICE_DLQ`, pero el worker necesita un
   * envio explicito cuando su propio bucle de reintentos se rinde, para que el
   * comprobante quede visible en el monitor de DLQ.
   */
  async moveToDlq(jobData: InvoiceJobData, motivo: string): Promise<void> {
    try {
      await this.boss.send(INVOICE_DLQ, {
        ...jobData,
        motivo,
        enviado_a_dlq_en: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo mover el comprobante ${jobData.invoice_id} a la DLQ: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * TA-67: encola el envío de un resumen diario o de una comunicación de baja.
   *
   * Devuelve el id del job (o `null` si pg-boss no está disponible) para que
   * quien llama pueda informarlo; no se espera el resultado dentro de la misma
   * petición HTTP porque el CDR de un resumen puede tardar.
   */
  async encolarResumen(job: SummaryJobData, startAfter?: Date): Promise<string | null> {
    try {
      return startAfter === undefined
        ? await this.boss.send(SUMMARY_QUEUE, job)
        : await this.boss.send(SUMMARY_QUEUE, job, { startAfter });
    } catch (error) {
      this.logger.error(
        `No se pudo encolar el ${job.tipo} ${job.identificador}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * TA-67: registra el consumidor de resúmenes.
   *
   * Igual que en la cola de comprobantes, `batchSize: 1`: el resumen de un día
   * se procesa de uno en uno para que el sondeo del ticket no compita con otra
   * operación del mismo periodo.
   */
  async registerSummaryWorker(
    handler: (job: SummaryJobData) => Promise<unknown>,
  ): Promise<string> {
    if (this.bypass) return '';

    this.logger.log(
      `Registrando worker de resumenes en la cola ${SUMMARY_QUEUE}`,
    );

    return this.boss.work<SummaryJobData>(
      SUMMARY_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        const job = jobs[0];
        if (!job) return;

        this.logger.log(
          `[Job resumen recibido] ${job.data.tipo} ${job.data.identificador}`,
        );
        await handler(job.data);
      },
    );
  }

  /**
   * Encola la consulta de períodos SIRE.
   *
   * La cola es infraestructura: si falla, el error original (que puede
   * traer la cadena de conexión o el mensaje del driver) se registra solo en
   * el log del servidor y lo que sale hacia el controlador es siempre un
   * `ServiceUnavailableException` con un texto fijo. Así ningún detalle de
   * PgBoss puede llegar al cliente por accidente.
   */
  async enqueueSirePeriods(job: SirePeriodsJobData): Promise<string> {
    if (this.bypass) {
      this.logger.error(
        `No se puede encolar la consulta SIRE ${job.messageId}: PgBoss está en modo bypass.`,
      );
      throw new ServiceUnavailableException(
        'La cola de consultas SIRE no está disponible.',
      );
    }

    let jobId: string | null = null;
    try {
      jobId = await this.boss.send(SIRE_PERIODS_QUEUE, job, {
        id: job.messageId,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo encolar la consulta SIRE ${job.messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar la consulta SIRE en la cola.',
      );
    }

    if (!jobId) {
      this.logger.error(
        `PgBoss no devolvió id para la consulta SIRE ${job.messageId}.`,
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar la consulta SIRE en la cola.',
      );
    }
    return jobId;
  }

  async registerSirePeriodsWorker(
    handler: (job: SirePeriodsJobData) => Promise<unknown>,
  ): Promise<string> {
    if (this.bypass) {
      this.logger.warn(
        `No se registra el worker ${SIRE_PERIODS_QUEUE}: PgBoss está en modo bypass.`,
      );
      return '';
    }

    this.logger.log(`Registrando worker de SIRE en ${SIRE_PERIODS_QUEUE}`);
    const workerId = await this.boss.work<SirePeriodsJobData>(
      SIRE_PERIODS_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        const job = jobs[0];
        if (!job) return;
        await handler(job.data);
      },
    );
    this.logger.log(
      `Worker de SIRE registrado en ${SIRE_PERIODS_QUEUE} (id=${workerId})`,
    );
    return workerId;
  }

  async registerSirePeriodsDlqWorker(
    handler: (job: SirePeriodsJobData) => Promise<unknown>,
  ): Promise<string> {
    if (this.bypass) {
      this.logger.warn(
        `No se registra el worker de DLQ ${SIRE_PERIODS_DLQ}: PgBoss está en modo bypass.`,
      );
      return '';
    }

    this.logger.log(`Registrando worker de DLQ SIRE en ${SIRE_PERIODS_DLQ}`);
    const workerId = await this.boss.work<SirePeriodsJobData>(
      SIRE_PERIODS_DLQ,
      { batchSize: 1 },
      async (jobs) => {
        const job = jobs[0];
        if (!job) return;
        await handler(job.data);
      },
    );
    this.logger.log(
      `Worker de DLQ SIRE registrado en ${SIRE_PERIODS_DLQ} (id=${workerId})`,
    );
    return workerId;
  }

  /** TA-67: trabajos de resumen que quedaron sin procesar en la DLQ. */
  async listSummaryDlq(
    companyId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const jobs = await this.boss.findJobs<SummaryJobData>(SUMMARY_DLQ, {
      queued: true,
    });

    return jobs
      .filter((job) => job.data?.companyId === companyId)
      .map((job) => ({
        id: job.id,
        identificador: job.data?.identificador ?? 'sin identificar',
        tipo: job.data?.tipo ?? 'RESUMEN_DIARIO',
        intentosFallidos: job.retryCount ?? 0,
      }));
  }
}
