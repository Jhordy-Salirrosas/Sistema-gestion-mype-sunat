# Especificación Técnica: Módulo 2 — Core de Resiliencia, Outbox y Caos

**Responsable Asignado:** Oliver Saldaña  
**Módulo:** `src/modules/resilience/`  
**Esquema de BD:** `prisma/schema/resilience.prisma`  
**Métricas del Charter:** MTTD $\le 5\text{ s}$, MTTR $\le 60\text{ s}$, Pérdida $\le 0\%$, Latencia $\le 500\text{ ms}$  

---

## 1. Propósito y Alcance

Garantizar la alta disponibilidad y tolerancia a fallos del sistema frente a caídas, timeouts e inestabilidades de SUNAT:
1. **Patrón Transactional Outbox:** Encolado atómico en PostgreSQL con `pg-boss` para desacoplar el tiempo de respuesta HTTP ($\le 500\text{ ms}$) del tiempo de procesamiento externo de SUNAT (2 a 10 s).
2. **Workers en Segundo Plano:** Consumo asíncrono con reintentos basados en **Exponential Backoff**.
3. **Dead Letter Queue (DLQ):** Aislamiento de comprobantes fallidos tras agotar los reintentos para evitar pérdida de transacciones.
4. **Patrón Circuit Breaker:** Protección contra tormentas de peticiones ante caídas masivas de SUNAT (estados CLOSED, OPEN, HALF-OPEN).
5. **Servidor Mock de Caos:** Inyector de fallos HTTP 503 y latencias configurables para medición automatizada de MTTD y MTTR.

---

## 2. Reglas Matemáticas y de Resiliencia (Capa de Dominio)

### 2.1. Regla 1: Política de Exponential Backoff (HU-04)
La política es pura y vive en `domain/rules/backoffPolicy.ts`. Se aplica a cada
envío de comprobante:
$$\text{Retardo}(n) \in \{5,\ 15,\ 45\}\ \text{segundos} \quad \text{para } n = 1, 2, 3$$
* Envío inicial inmediato.
* Tras el fallo 1: reintento a los 5 segundos.
* Tras el fallo 2: reintento a los 15 segundos.
* Tras el fallo 3: reintento a los 45 segundos.
* Tras el fallo 4 (3 reintentos agotados): el job se mueve a la DLQ
  (`sunat-invoice-dlq`) y la Invoice pasa a `ERROR_RED`.
* Solo se reintenta si el resultado es `reintentable` (error de red, timeout,
  5xx o CDR ilegible). Un rechazo de negocio del CDR (`reintentable = false`)
  detiene el flujo sin DLQ y conserva el estado que persistió SUNAT.
* Cada intento queda auditado en `TransactionHistory` con su número de intento
  (`intento` 1..4).

> Nota de lectura: la historia habla de "3 intentos" y de tres retardos. Un
> retardo solo aplica si hay un envío posterior, por lo que se implementan
> **3 reintentos (4 envíos)**. Es la misma lectura de TA-38 ("se agotan 3
> reintentos") y TA-57 ("se reintentan 3 veces").

### 2.2. Regla 2: Máquina de Estados del Circuit Breaker
* **CLOSED (Operación Normal):** Las peticiones fluyen al cliente SOAP/Mock. Si se acumulan 5 errores consecutivos (HTTP 503 o timeouts $\ge 5000\text{ ms}$), el circuito transiciona inmediatamente a **OPEN**.
* **OPEN (Circuito Abierto):** Se bloquea todo intento de conexión de red hacia SUNAT durante una ventana de enfriamiento de **30 segundos**. Las facturas entrantes se guardan en el Outbox sin intentar contactar a SUNAT.
* **HALF-OPEN (Prueba de Recuperación):** Transcurridos los 30 segundos, el circuito permite pasar exactamente **1 petición de prueba**:
  * Si la petición es exitosa $\rightarrow$ El circuito se cierra (**CLOSED**) y los contadores se reinician.
  * Si la petición falla $\rightarrow$ El circuito vuelve a abrirse (**OPEN**) por otros 30 segundos.

### 2.3. Regla 3: Métricas de Resiliencia (MTTD y MTTR)
* **MTTD (Mean Time to Detect):** Tiempo transcurrido desde el primer error 503 inyectado hasta la apertura del Circuit Breaker.
  $$\text{MTTD} = T_{\text{circuito\_open}} - T_{\text{primer\_error\_503}} \quad (\text{Meta: } \le 5\text{ s})$$
* **MTTR (Mean Time to Recover):** Tiempo desde que SUNAT/Mock se restablece hasta que la cola de tareas pendientes es drenada en su totalidad.
  $$\text{MTTR} = T_{\text{cola\_vaciada}} - T_{\text{restablecimiento\_servicio}} \quad (\text{Meta: } \le 60\text{ s})$$

---

## 3. Estructura de Directorios del Módulo (`src/modules/resilience/`)

```text
src/modules/resilience/
├── resilienceModule.ts               # Módulo NestJS que exporta el QueueModule y componentes de caos
│
├── domain/                           # [CAPA 1: DOMINIO PURO]
│   ├── entities/                     # TransactionHistoryEntity, CircuitBreakerStateEntity
│   ├── rules/                        # backoffPolicy.ts: retardos 5/15/45 s y decisión de reintento
│   ├── value-objects/                # BackoffDelayVo, BreakerThresholdVo
│   └── ports/                        # IOutboxQueuePort, ICircuitBreakerPort, IChaosSimulatorPort
│
├── application/                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/                          # TriggerChaosDto, RetryDlqJobDto, MetricsResponseDto
│   └── use-cases/                    # ProcessOutboxJobsUseCase, RetryDlqJobUseCase, MeasureMetricsUseCase
│
└── infrastructure/                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── queue/
    │   ├── queue.service.ts          # Adaptador pg-boss (fromPrisma, send, DLQ, start, stop)
    │   ├── invoiceRetryService.ts    # Orquestador HU-04: 3 reintentos, ERROR_RED y DLQ
    │   └── queueModule.ts            # Módulo NestJS exportable para enqueueInvoiceInTx
    ├── mock/
    │   ├── sunat-mock.controller.ts  # Endpoints REST de inyección de caos y simulación SOAP
    │   ├── sunat-mock.service.ts     # Lógica del mock (toggle 503, retardo artificial, CDR fixtures)
    │   └── sunatMockModule.ts        # Módulo NestJS del Mock de Caos
    └── circuitBreaker/
        └── circuitBreakerAdapter.ts  # Adaptador de máquina de estados en memoria
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Lógica pura de cálculo de backoff exponencial, fórmulas de métricas MTTD/MTTR y definición de estados del Circuit Breaker.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar librerías de colas (`pg-boss`) o dependencias de red.
  * Realizar llamadas síncronas de I/O o timers reales (`setTimeout`). La lógica matemática de intervalos debe ser pura.

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Casos de uso de procesamiento de cola, reintento manual de trabajos desde la DLQ y cálculo de métricas consolidadas.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar `PrismaService` directamente sin pasar por puertos de persistencia de auditoría.
  * Manejar HTTP Exceptions directamente en la lógica del caso de uso.

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** 
  * `queue/`: Maneja la conexión de `pg-boss` utilizando `fromPrisma(tx)` para garantizar atomicidad ACID en transacciones locales.
  * `mock/`: Implementa endpoints para activar caos (`POST /api/v1/resilience/mock/chaos`) y el endpoint simulador de SUNAT.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Dejar el Mock de Caos activo por defecto en producción (`NODE_ENV=production` debe desactivar la inyección de fallos).
  * Mezclar el almacenamiento de `pg-boss` en una base de datos distinta a la de negocio (deben compartir la misma BD para preservar transaccionalidad ACID sin Sagas distribuidas).

### 4.4. Fronteras Modulares (Anti-Acoplamiento)
* **Servicios públicos exportados:** `QueueService.enqueueInvoiceInTx(tx, invoiceId)` para el Outbox y `InvoiceRetryService.processWithRetry(job)` para que el consumidor de TA-57 aplique el backoff de HU-04. `InvoiceRetryService` es el único punto que mueve jobs a la DLQ y marca la Invoice en `ERROR_RED`; el worker de facturación no debe reimplementar esa secuencia.
* **Prohibido:** Modificar tablas de facturación desde workers de resiliencia mediante SQL directo. Se deben utilizar los puertos públicos o eventos emitidos.

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
export const OUTBOX_QUEUE_PORT = Symbol('OUTBOX_QUEUE_PORT');
export const CIRCUIT_BREAKER_PORT = Symbol('CIRCUIT_BREAKER_PORT');

export interface IOutboxQueuePort {
  enqueueInvoiceJob(txClient: unknown, invoiceId: string): Promise<string | null>;
  retryDlqJob(jobId: string): Promise<void>;
  getPendingJobsCount(): Promise<number>;
}

export interface ICircuitBreakerPort {
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  recordSuccess(): void;
  recordFailure(): void;
  reset(): void;
}
```

---

## 6. Flujo de Implementación Paso a Paso para el Desarrollador (Workflow)

Cuando Oliver deba implementar o extender una funcionalidad de resiliencia:

1. **Paso 1 (Lógica de Resiliencia Pura):** Escribir la máquina de estados o cálculo de backoff en `domain/rules/`. Crear de inmediato su test unitario en `test/unit/resilience/`.
2. **Paso 2 (Contrato de Puerto):** Definir la interfaz en `domain/ports/` (ej. `ICircuitBreakerPort`).
3. **Paso 3 (Caso de Uso):** Implementar la orquestación en `application/use-cases/` (ej. `ProcessOutboxJobsUseCase`).
4. **Paso 4 (Adaptador de Infraestructura):** Implementar el worker o el cliente en `infrastructure/queue/` o `infrastructure/circuitBreaker/`.
5. **Paso 5 (Endpoints de Caos / Dashboard):** Exponer métricas y switches de caos en `infrastructure/mock/sunat-mock.controller.ts`.
6. **Paso 6 (Prueba de Caos y Verificación):**
   ```bash
   npm test -- test/unit/resilience
   npm run lint
   npm run build
   ```

---

## 7. Casos de Prueba Requeridos en `test/unit/resilience/` y `test/chaos/`

1. **`sunat-mock.service.spec.ts`:** Verificación de inyección de error 503 y respuesta de fixture CDR válida cuando el caos está inactivo.
2. **`sunat-mock.controller.spec.ts`:** Control de encendido/apagado del modo caos vía REST.
3. **`queue.service.spec.ts`:** Encolado transaccional con cliente `fromPrisma(tx)` y manejo de excepciones.
4. **`backoffPolicy.spec.ts`:** Retardos 5/15/45 s, 3 reintentos, decisión DLQ y rechazo de negocio sin reintento.
5. **`invoiceRetryService.spec.ts`:** Con fallos de red forzados, verifica la secuencia de esperas, la auditoría de los 4 intentos, el paso a la DLQ y la Invoice en `ERROR_RED`; además, que un rechazo de negocio no se reintenta.
6. **Pruebas de Caos (`test/chaos/`):** Medición automatizada de MTTD $\le 5\text{ s}$ ante inyección masiva de 503 y MTTR $\le 60\text{ s}$ tras apagado de caos.

---

## 8. Buenas Prácticas Innegociables y DoD

* **Límite de líneas:** Archivos concisos (< 150 líneas).
* **Cero `any`:** Tipado estricto en payloads de colas y contratos de jobs.
* **Transaccionalidad obligatoria:** Todo encolado de Outbox debe aceptar el cliente `tx` de Prisma para garantizar atomicidad (todo o nada).
