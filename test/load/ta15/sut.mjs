/**
 * SUT de laboratorio para TA-15.
 *
 * Ejercita el `CircuitBreaker` REAL compilado en `dist/` con un SUNAT falso:
 *  - durante la caída, cada envío falla con 503 y se encola;
 *  - tras 5 fallos el circuito abre y los envíos se contestan 202 (en cola);
 *  - al volver SUNAT, el circuito espera 30 s, prueba una petición y drena la
 *    cola, midiendo MTTR y tasa de recuperación.
 *
 * No reemplaza el worker de pg-boss (TA-57): es el entorno controlado para
 * medir carga, caos y MTTR sin depender de Supabase.
 */
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  CircuitBreaker,
  CircuitState,
} = require('../../../dist/modules/resilience/infrastructure/circuitBreaker/circuitBreaker.js');

const PORT = Number(process.env.PORT || 3100);
const breaker = new CircuitBreaker();

let outage = false;
let outageStartedAt = null;
let restoredAt = null;
let mttrMs = null;
let queued = 0;
let processed = 0;
let failedAttempts = 0;
let accepted = 0;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('body demasiado grande'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function reiniciarMetricas() {
  queued = 0;
  processed = 0;
  failedAttempts = 0;
  accepted = 0;
  mttrMs = null;
  restoredAt = null;
  outageStartedAt = null;
}

function drenarCola() {
  if (outage || breaker.getState() !== CircuitState.CLOSED) return;
  if (queued === 0) return;

  const lote = Math.min(queued, 500);
  queued -= lote;
  processed += lote;

  if (mttrMs === null && restoredAt !== null) {
    mttrMs = Date.now() - restoredAt;
  }
}

setInterval(drenarCola, 100).unref();

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { status: 'ok' });
  }

  if (req.method === 'POST' && req.url === '/send') {
    try {
      const resultado = await breaker.ejecutar(async () => {
        if (outage) throw new Error('SUNAT 503');
        return true;
      });

      if (!resultado.ejecutado) {
        queued += 1;
        return json(res, 202, { queued: true, circuit: 'OPEN' });
      }

      accepted += 1;
      return json(res, 200, { accepted: true });
    } catch {
      failedAttempts += 1;
      queued += 1;
      return json(res, 202, { queued: true, retry: true });
    }
  }

  if (req.method === 'POST' && req.url === '/chaos') {
    const body = await readBody(req);
    const down = body.down === true;

    if (down && !outage) {
      reiniciarMetricas();
      breaker.reiniciar();
      outage = true;
      outageStartedAt = Date.now();
      return json(res, 200, { down: true });
    }

    if (!down && outage) {
      outage = false;
      restoredAt = Date.now();
      return json(res, 200, { down: false });
    }

    return json(res, 200, { down: outage });
  }

  if (req.method === 'GET' && req.url === '/metrics') {
    const total = processed + queued;
    return json(res, 200, {
      breakerState: breaker.getState(),
      outage,
      outageStartedAt,
      restoredAt,
      mttrMs,
      accepted,
      failedAttempts,
      queued,
      processed,
      pending: queued,
      recoveryRate: total === 0 ? 1 : processed / total,
    });
  }

  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[TA-15] SUT escuchando en http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
