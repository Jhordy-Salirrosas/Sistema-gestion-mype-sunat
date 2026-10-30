/**
 * TA-15 — carga sostenida + caída controlada + recuperación.
 *
 * K6 genera una tasa constante de envíos contra el SUT de laboratorio. El
 * runner (`run-ta15.mjs`) activa y desactiva la caída; al terminar se leen las
 * métricas del SUT y se genera el reporte.
 *
 * Variables:
 *   BASE_URL   URL del SUT (por defecto http://127.0.0.1:3100)
 *   RATE       peticiones por segundo (por defecto 10; mínimo exigido 5)
 *   DURATION   duración total, p. ej. 45s o 21m
 */
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const sendLatency = new Trend('send_latency', true);

export const options = {
  scenarios: {
    carga: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 10),
      timeUnit: '1s',
      duration: __ENV.DURATION || '45s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 100),
      exec: 'sendInvoice',
    },
  },
  thresholds: {
    http_req_duration: ['avg<500', 'p(95)<1000'],
    http_reqs: ['rate>=5'],
    checks: ['rate>=0.95'],
    send_latency: ['p(95)<1000'],
  },
};

export function sendInvoice() {
  const response = http.post(
    `${__ENV.BASE_URL || 'http://127.0.0.1:3100'}/send`,
    JSON.stringify({}),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'send' },
    },
  );

  sendLatency.add(response.timings.duration);
  check(response, {
    'envio aceptado o encolado': (r) => r.status === 200 || r.status === 202,
  });
}
