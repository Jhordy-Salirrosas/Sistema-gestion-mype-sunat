# Especificación Técnica de Módulo: 02_RESILIENCE (Dashboard de Resiliencia y Caos)
## Guía Operativa para Desarrolladores y Agentes de IA

**Módulo:** `src/modules/resilience/`  
**Responsable Técnico:** Oliver Saldaña  
**Normativa Internacional:** ISO/IEC 25010 (Tolerancia a fallos y Recuperabilidad)  
**Estatus:** 🔒 VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito del Módulo
El módulo `resilience` constituye el **sello diferenciador** de SYNC-SUNAT:
1. Monitoreo en tiempo real del estado del **Circuit Breaker** del backend (`CLOSED`, `OPEN`, `HALF_OPEN`).
2. Sincronización continua con el `uiStore` para encender o apagar el [SunatStatusBanner.tsx](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/fronted-mype-sunat/src/components/feedback/SunatStatusBanner.tsx) en la cabecera de la aplicación.
3. Visualización y gestión de la **Dead Letter Queue (DLQ)**: Comprobantes que agotaron reintentos y requieren intervención o reintento manual.
4. **Simulador de Caos (Chaos Engineering):** Herramienta para inyectar latencia artificial o simular caídas de SUNAT para demostrar la tolerancia a fallos ante los evaluadores.

---

## 2. Mapa de Carpetas y Responsabilidades

```text
src/modules/resilience/
├── components/       # CircuitBreakerWidget.tsx, DlqTable.tsx, ChaosToggle.tsx, MetricsCard.tsx
├── hooks/            # useResilienceMetrics.ts, useDlqRetry.ts, useChaosControl.ts
├── pages/            # ResilienceDashboardPage.tsx
├── services/         # resilienceApi.ts (endpoints /resilience/metrics, /resilience/dlq, /resilience/chaos)
└── types/            # resilience.types.ts (CircuitBreakerMetrics, DlqItem, ChaosScenario)
```

---

## 3. Normativa de Desarrollo (Qué SÍ y qué NO se puede hacer)

### ✅ Lo que SÍ se debe hacer:
* El hook `useResilienceMetrics.ts` debe ejecutar un sondeo (*polling*) ligero cada 5 segundos (`refetchInterval: 5000`) para reflejar los cambios de estado en vivo.
* Cada vez que las métricas cambien de estado (`state: 'OPEN'`), se debe invocar `setSunatCircuitBreakerStatus` de `useUiStore` para que el banner global superior alerte a los demás módulos.
* La tabla de DLQ debe permitir el reintento de comprobantes con retroalimentación visual inmediata.
* Todo widget de métricas debe tener un badge de color normativo:
  - `CLOSED`: Verde / Esmeralda (Operatividad normal).
  - `HALF_OPEN`: Azul / Índigo (Comprobando estabilidad).
  - `OPEN`: Ámbar / Rojo (Circuit Breaker activado, contingencia outbox).

### 🚫 Lo que está TERMINANTEMENTE PROHIBIDO:
* **PROHIBIDO** desincronizar el estado del Circuit Breaker entre este módulo y el `uiStore`.
* **PROHIBIDO** realizar polling menor a 3 segundos para evitar saturación de red.
* **PROHIBIDO** meter la lógica de activación del simulador de caos dentro de componentes visuales; debe delegarse en `useChaosControl.ts`.
* **PROHIBIDO** crear archivos de más de 120 líneas.

---

  1. No altere el tipo de unión `'CLOSED' | 'OPEN' | 'HALF_OPEN'` sin verificar `uiStore.ts`.
  2. Asegure que los toggles de inyección de caos informen claramente su impacto en la UI.
  3. Verifique que `npm run build` pase con 0 errores tras cualquier edición.
  4. Toda prueba debe residir en `test/unit/modules/resilience/`, nunca en `src/`.

---

## 5. Estrategia de Pruebas Unitarias (`test/unit/modules/resilience/`)

* **Ubicación Exclusiva:** `test/unit/modules/resilience/`
* **Casos Críticos a Probar:**
  1. **`circuitBreakerSync.test.ts`:** Verificación de las transiciones de estado (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF_OPEN`) y propagación al `uiStore`.
  2. **`deadLetterQueue.test.ts`:** Reintentos de comprobantes en cola DLQ y manejo de errores persistentes.
  3. **`chaosSchema.test.ts`:** Validación de límites del simulador de latencia y tasa de error inyectada.

