/**
 * Runner de TA-15: levanta el SUT, ejecuta K6, controla la caída y escribe el
 * reporte con latencia, P95, throughput, MTTR y tasa de recuperación.
 *
 * Uso rápido (smoke, ~45 s):
 *   OUTAGE_SECONDS=5 WARMUP_SECONDS=2 RECOVERY_SECONDS=35 RATE=10 \
 *     node test/load/ta15/run-ta15.mjs
 *
 * Uso completo (20 min de caída):
 *   OUTAGE_SECONDS=1200 WARMUP_SECONDS=10 RECOVERY_SECONDS=60 RATE=10 \
 *     node test/load/ta15/run-ta15.mjs
 *
 * Requisitos:
 *   - `npm run build` (el SUT importa el CircuitBreaker compilado en dist/).
 *   - K6 instalado (`k6 version`) o ruta en K6_BIN.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const SUT = join(AQUI, 'sut.mjs');
const K6_SCRIPT = join(AQUI, 'k6-load-chaos.js');
const RESULTADOS = join(AQUI, 'results');
const DIST_BREAKER = join(
  RAIZ,
  'dist/modules/resilience/infrastructure/circuitBreaker/circuitBreaker.js',
);

const PUERTO = Number(process.env.PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PUERTO}`;
const CAIDA_SEG = Number(process.env.OUTAGE_SECONDS || 1200);
const CALENTAMIENTO_SEG = Number(process.env.WARMUP_SECONDS || 10);
const RECUPERACION_SEG = Number(process.env.RECOVERY_SECONDS || 60);
const RATE = Number(process.env.RATE || 10);
const K6_BIN = process.env.K6_BIN || 'k6';
const DURACION_SEG =
  CALENTAMIENTO_SEG + CAIDA_SEG + RECUPERACION_SEG + 2;
const ES_COMPLETO = CAIDA_SEG >= 1200;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperar(url, timeoutMs = 15_000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // El servidor aún no está listo.
    }
    await dormir(250);
  }
  throw new Error(`Timeout esperando ${url}`);
}

async function chaos(down) {
  const res = await fetch(`${BASE_URL}/chaos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ down }),
  });
  if (!res.ok) throw new Error(`/chaos respondió ${res.status}`);
}

async function metricas() {
  const res = await fetch(`${BASE_URL}/metrics`);
  if (!res.ok) throw new Error(`/metrics respondió ${res.status}`);
  return res.json();
}

function numero(valor, defecto = 0) {
  return Number.isFinite(Number(valor)) ? Number(valor) : defecto;
}

function escribirReporte(datos) {
  const filas = [
    ['Latencia promedio', `${datos.avgMs.toFixed(2)} ms`, '≤ 500 ms', datos.avgMs <= 500],
    ['P95', `${datos.p95Ms.toFixed(2)} ms`, '≤ 1000 ms', datos.p95Ms <= 1000],
    ['Throughput', `${datos.rate.toFixed(2)} ops/s`, '≥ 5 ops/s', datos.rate >= 5],
    ['MTTR', `${(datos.mttrMs / 1000).toFixed(2)} s`, '≤ 60 s', datos.mttrMs > 0 && datos.mttrMs <= 60_000],
    ['Recuperación', `${(datos.recoveryRate * 100).toFixed(2)}%`, '≥ 95%', datos.recoveryRate >= 0.95],
  ];

  const lineas = [
    '# TA-15 · Reporte de carga, caos y MTTR',
    '',
    `- **Fecha:** ${new Date().toISOString()}`,
    `- **Modo:** ${datos.modo}`,
    `- **Tasa objetivo:** ${RATE} req/s`,
    `- **Caída controlada:** ${CAIDA_SEG} s`,
    `- **Calentamiento:** ${CALENTAMIENTO_SEG} s`,
    `- **Ventana de recuperación:** ${RECUPERACION_SEG} s`,
    `- **Duración total K6:** ${DURACION_SEG} s`,
    '',
    '| Métrica | Valor | Umbral | Estado |',
    '|---|---:|---:|---|',
    ...filas.map(([m, v, u, ok]) => `| ${m} | ${v} | ${u} | ${ok ? '✅' : '❌'} |`),
    '',
    '## Detalle del SUT',
    '',
    `- Estado final del circuito: **${datos.breakerState}**`,
    `- Encolados durante la caída: **${datos.queued + datos.processed}**`,
    `- Procesados al cierre: **${datos.processed}**`,
    `- Pendientes al cierre: **${datos.pending}**`,
    `- Fallos de envío registrados: **${datos.failedAttempts}**`,
    `- Peticiones aceptadas después de recuperar: **${datos.accepted}**`,
    '',
    `**Resultado global:** ${datos.ok ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '> El SUT ejercita el `CircuitBreaker` real compilado en `dist/`. El worker',
    '> pg-boss de producción es TA-57; este arnés mide la política de forma',
    '> aislada y reproducible.',
    '',
  ];

  mkdirSync(RESULTADOS, { recursive: true });
  writeFileSync(join(RESULTADOS, 'report.md'), lineas.join('\n'), 'utf8');
  writeFileSync(
    join(RESULTADOS, 'metrics.json'),
    JSON.stringify(datos, null, 2),
    'utf8',
  );
}

async function principal() {
  if (!existsSync(DIST_BREAKER)) {
    throw new Error(
      'Falta dist/. Ejecuta `npm run build` antes de correr TA-15.',
    );
  }

  mkdirSync(RESULTADOS, { recursive: true });
  const summaryPath = join(RESULTADOS, 'summary.json');

  const sut = spawn(process.execPath, [SUT], {
    env: { ...process.env, PORT: String(PUERTO) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  sut.stderr.on('data', (d) => process.stderr.write(`[SUT] ${d}`));

  let k6 = null;
  try {
    await esperar(`${BASE_URL}/health`);

    k6 = spawn(
      K6_BIN,
      ['run', '--summary-export', summaryPath, K6_SCRIPT],
      {
        env: {
          ...process.env,
          BASE_URL,
          RATE: String(RATE),
          DURATION: `${DURACION_SEG}s`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    k6.stdout.on('data', (d) => process.stdout.write(d));
    k6.stderr.on('data', (d) => process.stderr.write(d));
    const k6Terminado = new Promise((resolve, reject) => {
      k6.on('close', (code) => resolve(code));
      k6.on('error', reject);
    });

    await dormir(CALENTAMIENTO_SEG * 1000);
    await chaos(true);
    // eslint-disable-next-line no-console
    console.log(`[TA-15] Caída activada por ${CAIDA_SEG} s`);
    await dormir(CAIDA_SEG * 1000);
    await chaos(false);
    // eslint-disable-next-line no-console
    console.log('[TA-15] SUNAT restablecido; midiendo recuperación');
    await dormir(RECUPERACION_SEG * 1000);

    const codigoK6 = await k6Terminado;
    if (codigoK6 !== 0) {
      // eslint-disable-next-line no-console
      console.warn(`[TA-15] k6 terminó con código ${codigoK6}`);
    }

    const m = await metricas();
    const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
    const dur = summary.metrics.http_req_duration ?? {};
    const reqs = summary.metrics.http_reqs ?? {};
    const avgMs = numero(dur.avg);
    const p95Ms = numero(dur['p(95)']);
    const rate = numero(reqs.rate);
    const mttrMs = numero(m.mttrMs, -1);
    const recoveryRate = numero(m.recoveryRate);
    const ok =
      avgMs <= 500 &&
      p95Ms <= 1000 &&
      rate >= 5 &&
      mttrMs > 0 &&
      mttrMs <= 60_000 &&
      recoveryRate >= 0.95;

    const datos = {
      modo: ES_COMPLETO ? 'completo (20 min de caída)' : 'smoke',
      avgMs,
      p95Ms,
      rate,
      mttrMs,
      recoveryRate,
      ok,
      ...m,
    };

    escribirReporte(datos);
    // eslint-disable-next-line no-console
    console.log(
      `[TA-15] avg=${avgMs.toFixed(1)}ms p95=${p95Ms.toFixed(1)}ms ` +
        `rate=${rate.toFixed(2)}/s mttr=${(mttrMs / 1000).toFixed(2)}s ` +
        `recovery=${(recoveryRate * 100).toFixed(1)}% => ${ok ? 'PASS' : 'FAIL'}`,
    );
    // eslint-disable-next-line no-console
    console.log(`[TA-15] Reporte: ${join(RESULTADOS, 'report.md')}`);

    process.exitCode = ok ? 0 : 1;
  } finally {
    if (k6 && k6.exitCode === null) k6.kill('SIGTERM');
    sut.kill('SIGTERM');
  }
}

principal().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[TA-15] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
