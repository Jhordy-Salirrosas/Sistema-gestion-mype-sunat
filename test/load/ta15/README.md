# TA-15 · Pruebas de carga, caos y MTTR

Arnés reproducible para ejecutar **K6** con carga sostenida, una **caída
controlada** y la medición de **MTTR** y **tasa de recuperación** en una sola
corrida.

## Componentes

| Archivo | Rol |
|---|---|
| `k6-load-chaos.js` | Escenario K6 de tasa constante (`constant-arrival-rate`) con umbrales de latencia, P95, throughput y checks. |
| `sut.mjs` | SUT de laboratorio: usa el `CircuitBreaker` **real** compilado en `dist/` y un SUNAT falso que falla durante la caída. Encola los envíos y los drena al recuperarse. |
| `run-ta15.mjs` | Orquestador: levanta el SUT, lanza K6, activa/desactiva la caída, lee métricas y genera `results/report.md`. |
| `results/report.md` | Reporte de la última corrida. |
| `results/metrics.json` | Métricas crudas del SUT. |

## Requisitos

1. Backend compilado: el SUT importa el `CircuitBreaker` real desde `dist/`.

```bash
npm run build
```

2. K6 instalado. En Linux:

```bash
curl -sSL -o /tmp/k6.tar.gz \
  https://github.com/grafana/k6/releases/download/v2.3.0/k6-v2.3.0-linux-amd64.tar.gz
tar -xzf /tmp/k6.tar.gz -C /tmp
export K6_BIN=/tmp/k6-v2.3.0-linux-amd64/k6
k6 version
```

## Corrida rápida (smoke, ~45 s)

Sirve para validar el arnés y generar una captura de evidencia:

```bash
K6_BIN=/tmp/k6-v2.3.0-linux-amd64/k6 \
OUTAGE_SECONDS=5 WARMUP_SECONDS=2 RECOVERY_SECONDS=35 RATE=10 \
node test/load/ta15/run-ta15.mjs
```

## Corrida completa (20 min de caída)

```bash
K6_BIN=/tmp/k6-v2.3.0-linux-amd64/k6 \
OUTAGE_SECONDS=1200 WARMUP_SECONDS=10 RECOVERY_SECONDS=60 RATE=10 \
node test/load/ta15/run-ta15.mjs
```

La corrida completa tarda aproximadamente **21 min 12 s**. Al terminar, el
reporte queda en `test/load/ta15/results/report.md`.

## Variables

| Variable | Defecto | Descripción |
|---|---:|---|
| `OUTAGE_SECONDS` | `1200` | Duración de la caída controlada. |
| `WARMUP_SECONDS` | `10` | Carga previa antes de la caída. |
| `RECOVERY_SECONDS` | `60` | Ventana para drenar la cola y medir recuperación. |
| `RATE` | `10` | Peticiones por segundo. El mínimo exigido es 5. |
| `K6_BIN` | `k6` | Ruta al binario de K6. |
| `PORT` | `3100` | Puerto del SUT local. |

## Umbrales

| Métrica | Umbral |
|---|---:|
| Latencia promedio | ≤ 500 ms |
| P95 | ≤ 1000 ms |
| Throughput | ≥ 5 ops/s |
| MTTR | ≤ 60 s |
| Recuperación | ≥ 95% |

## Cómo interpreta el SUT la caída

1. K6 empieza a enviar a `POST /send`.
2. El runner activa `POST /chaos { down: true }`; el SUT simula SUNAT caída.
3. Los primeros 5 envíos fallan y abren el `CircuitBreaker` real.
4. Los envíos siguientes se contestan `202` y se **encolan** (no se pierden).
5. El runner restablece SUNAT con `POST /chaos { down: false }`.
6. Tras la ventana de 30 s, el circuito pasa a `HALF_OPEN`, la petición de
   prueba acierta, vuelve a `CLOSED` y se drena la cola.
7. `MTTR` = tiempo desde el restablecimiento hasta el primer drenaje.
8. `Recuperación` = procesados / (procesados + pendientes) al cierre.

## Limitación

Este SUT mide la **política de resiliencia** (Circuit Breaker, cola y drenaje)
de forma aislada y reproducible. El consumidor pg-boss real y el envío SOAP de
punta a punta son **TA-57**; cuando esté cableado, el mismo K6 puede apuntar al
backend real cambiando `BASE_URL` y los endpoints de control.
