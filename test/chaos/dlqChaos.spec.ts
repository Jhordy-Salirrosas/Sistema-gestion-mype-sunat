/**
 * Pruebas de Caos — Dead Letter Queue de pg-boss (M2).
 *
 * Verifica el ultimo eslabon de la resiliencia: un comprobante que SUNAT sigue
 * rechazando mientras el Circuit Breaker esta OPEN agota sus reintentos, queda
 * en estado terminal y se enruta a la DLQ sin perder la transaccion.
 *
 * Requiere PostgreSQL real: la atomicidad del Outbox y el archivado en la DLQ
 * solo se demuestran contra la base de datos. Sin base disponible la suite se
 * omite con aviso (el CI si provee el servicio).
 */
import { DLQ_QUEUE, MAIN_QUEUE } from './chaosHarness';
import {
  TEST_DB_URL,
  baseDeDatosDisponible,
  cargarPgBoss,
  estadoDelJob,
  estadosDeJobs,
  limpiarColas,
  procesarHastaAgotarReintentos,
} from './dlqTestSupport';

jest.setTimeout(60_000);

describe('M2 · DLQ de pg-boss (requiere PostgreSQL)', () => {
  let disponible = true;

  beforeAll(async () => {
    disponible = await baseDeDatosDisponible();

    if (!disponible) {
      // eslint-disable-next-line no-console
      console.warn(
        `\n[CHAOS] PostgreSQL no disponible en ${TEST_DB_URL}; ` +
          'prueba de DLQ OMITIDA.\n',
      );
    }
  });

  it('archiva en la DLQ un job que agota sus reintentos', async () => {
    if (!disponible) {
      expect(disponible).toBe(false);
      return;
    }

    const PgBoss = cargarPgBoss();
    const boss = new PgBoss(TEST_DB_URL);
    await boss.start();

    const RETRY_LIMIT = 2;

    try {
      // Se parte de un estado limpio para que otros jobs no contaminen el
      // conteo de esta prueba.
      await limpiarColas(boss, [MAIN_QUEUE, DLQ_QUEUE]);

      // La DLQ debe existir antes de crear la cola que la referencia.
      await boss.createQueue(DLQ_QUEUE);
      await boss.createQueue(MAIN_QUEUE, {
        retryLimit: RETRY_LIMIT,
        retryDelay: 0,
        retryBackoff: false,
        deadLetter: DLQ_QUEUE,
      });

      // pg-boss persiste el destino DLQ dentro del propio job (`dead_letter`)
      // al crearlo, por eso debe declararse tambien en el envio.
      const jobId = await boss.send(
        MAIN_QUEUE,
        { invoice_id: `chaos-${Date.now()}` },
        {
          retryLimit: RETRY_LIMIT,
          retryDelay: 0,
          retryBackoff: false,
          deadLetter: DLQ_QUEUE,
        },
      );
      expect(jobId).toBeTruthy();

      // SUNAT rechaza cada intento mientras el circuito esta OPEN.
      const intentos = await procesarHastaAgotarReintentos(
        boss,
        MAIN_QUEUE,
        RETRY_LIMIT,
      );

      const estadoOriginal = await estadoDelJob(boss, jobId as string);
      const enPrincipal = await estadosDeJobs(boss, MAIN_QUEUE);
      const enDlq = await estadosDeJobs(boss, DLQ_QUEUE);

      // eslint-disable-next-line no-console
      console.log(
        `[CHAOS] intentos=${intentos} estadoJob=${estadoOriginal} ` +
          `main=${JSON.stringify(enPrincipal)} dlq=${JSON.stringify(enDlq)}`,
      );

      // 1. Hubo reintentos reales.
      expect(intentos).toBeGreaterThanOrEqual(1);

      // 2. El job original quedo terminal en la cola principal.
      expect(estadoOriginal).toBe('failed');

      // 3. La DLQ recibio exactamente un job nuevo (estado inicial `created`).
      expect(enDlq.created).toBe(1);

      // Las colas de caos derivan de las de produccion, con sufijo propio para
      // no colisionar con otras suites que usan las mismas colas en paralelo.
      expect(MAIN_QUEUE).toMatch(/^sunat-invoice-queue/);
      expect(DLQ_QUEUE).toMatch(/^sunat-invoice-dlq/);
    } finally {
      await boss.stop();
    }
  });
});
