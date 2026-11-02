# TA-15 · Reporte de carga, caos y MTTR

- **Fecha:** 2026-10-31T05:21:00.135Z
- **Modo:** completo (20 min de caída)
- **Tasa objetivo:** 10 req/s
- **Caída controlada:** 1200 s
- **Calentamiento:** 10 s
- **Ventana de recuperación:** 60 s
- **Duración total K6:** 1272 s

| Métrica | Valor | Umbral | Estado |
|---|---:|---:|---|
| Latencia promedio | 0.45 ms | ≤ 500 ms | ✅ |
| P95 | 0.71 ms | ≤ 1000 ms | ✅ |
| Throughput | 10.00 ops/s | ≥ 5 ops/s | ✅ |
| MTTR | 1.87 s | ≤ 60 s | ✅ |
| Recuperación | 100.00% | ≥ 95% | ✅ |

## Detalle del SUT

- Estado final del circuito: **CLOSED**
- Encolados durante la caída: **12018**
- Procesados al cierre: **12018**
- Pendientes al cierre: **0**
- Fallos de envío registrados: **44**
- Peticiones aceptadas después de recuperar: **602**

**Resultado global:** ✅ PASS

> El SUT ejercita el `CircuitBreaker` real compilado en `dist/`. El worker
> pg-boss de producción es TA-57; este arnés mide la política de forma
> aislada y reproducible.
