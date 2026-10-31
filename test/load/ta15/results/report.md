# TA-15 · Reporte de carga, caos y MTTR

- **Fecha:** 2026-10-29T17:45:52.077Z
- **Modo:** smoke
- **Tasa objetivo:** 10 req/s
- **Caída controlada:** 5 s
- **Calentamiento:** 2 s
- **Ventana de recuperación:** 35 s
- **Duración total K6:** 44 s

| Métrica | Valor | Umbral | Estado |
|---|---:|---:|---|
| Latencia promedio | 0.57 ms | ≤ 500 ms | ✅ |
| P95 | 0.79 ms | ≤ 1000 ms | ✅ |
| Throughput | 10.00 ops/s | ≥ 5 ops/s | ✅ |
| MTTR | 25.48 s | ≤ 60 s | ✅ |
| Recuperación | 100.00% | ≥ 95% | ✅ |

## Detalle del SUT

- Estado final del circuito: **CLOSED**
- Encolados durante la caída: **304**
- Procesados al cierre: **304**
- Pendientes al cierre: **0**
- Fallos de envío registrados: **5**
- Peticiones aceptadas después de recuperar: **116**

**Resultado global:** ✅ PASS

> El SUT ejercita el `CircuitBreaker` real compilado en `dist/`. El worker
> pg-boss de producción es TA-57; este arnés mide la política de forma
> aislada y reproducible.
