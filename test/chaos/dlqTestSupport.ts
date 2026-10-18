/**
 * Utilidades de pg-boss para las pruebas de caos (M2).
 *
 * Encapsula el contrato minimo de pg-boss y la consulta del estado real de los
 * jobs. Se consulta `pgboss.job` directamente porque `getQueueStats` puede
 * servirse de su cache de contadores y devolver ceros sin contar nada.
 */

/** Connection string de la base de pruebas. */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:test@localhost:5435/ta13_test';

/** Job devuelto por `fetch`: pg-boss entrega objetos con su id. */
export interface PgBossJob {
  id: string;
  name?: string;
}

/** Contrato minimo de pg-boss usado por las pruebas. */
export interface PgBossLike {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  createQueue: (name: string, opts?: Record<string, unknown>) => Promise<void>;
  send: (
    name: string,
    data: unknown,
    options?: Record<string, unknown>,
  ) => Promise<string | null>;
  fetch: (name: string) => Promise<PgBossJob[] | null>;
  fail: (name: string, id: string, data?: unknown) => Promise<void>;
  getDb: () => {
    executeSql: (
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>;
  };
}

/** Carga la implementacion real de pg-boss del proyecto. */
export function cargarPgBoss(): new (conn: string) => PgBossLike {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const modulo = require('pg-boss') as {
    PgBoss: new (conn: string) => PgBossLike;
  };
  return modulo.PgBoss;
}

/** Comprueba si hay PostgreSQL disponible y arrancable. */
export async function baseDeDatosDisponible(): Promise<boolean> {
  const PgBoss = cargarPgBoss();
  const sonda = new PgBoss(TEST_DB_URL);

  try {
    await sonda.start();
    await sonda.stop();
    return true;
  } catch {
    return false;
  }
}

/** Elimina todos los jobs (de cualquier estado) de las colas indicadas. */
export async function limpiarColas(
  boss: PgBossLike,
  colas: readonly string[],
): Promise<void> {
  await boss
    .getDb()
    .executeSql('DELETE FROM pgboss.job WHERE name = ANY($1::text[])', [
      [...colas],
    ]);
}

/** Estado actual de un job concreto dentro de `pgboss.job`. */
export async function estadoDelJob(
  boss: PgBossLike,
  jobId: string,
): Promise<string | null> {
  const { rows } = await boss
    .getDb()
    .executeSql('SELECT state FROM pgboss.job WHERE id = $1', [jobId]);

  const fila = rows[0];
  return fila ? String(fila.state) : null;
}

/**
 * Cuenta los jobs de una cola agrupados por estado.
 *
 * `getQueueStats` puede servirse de su cache de contadores y devolver ceros,
 * por eso se consulta la tabla directamente.
 */
export async function estadosDeJobs(
  boss: PgBossLike,
  cola: string,
): Promise<Record<string, number>> {
  const { rows } = await boss
    .getDb()
    .executeSql(
      'SELECT state, count(*)::int AS total FROM pgboss.job WHERE name = $1 GROUP BY state',
      [cola],
    );

  return rows.reduce<Record<string, number>>((acc, fila) => {
    acc[String(fila.state)] = Number(fila.total);
    return acc;
  }, {});
}

/**
 * Reclama y marca como fallidos todos los jobs de la cola hasta que deja de
 * entregar trabajo nuevo, respetando el limite de reintentos.
 *
 * pg-boss exige `retry_count >= retry_limit` para archivar en la DLQ, y cada
 * `fetch` incrementa el contador. Devuelve cuantos intentos se ejecutaron.
 */
export async function procesarHastaAgotarReintentos(
  boss: PgBossLike,
  cola: string,
  retryLimit: number,
): Promise<number> {
  let intentos = 0;

  for (let ciclo = 0; ciclo < retryLimit + 4; ciclo += 1) {
    const jobs = await boss.fetch(cola);
    if (!jobs || jobs.length === 0) break;

    for (const job of jobs) {
      intentos += 1;
      await boss.fail(cola, job.id, {
        message: 'SUNAT 503 (circuit OPEN)',
      });
    }

    // Sin retryDelay el reintento se reprograma de inmediato; se le da aire.
    await new Promise((resolver) => setTimeout(resolver, 350));
  }

  return intentos;
}
