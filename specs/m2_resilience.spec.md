# Especificación Técnica: Módulo 2 — Core de Resiliencia, Outbox y Caos

**Responsable Asignado:** Oliver Saldaña  
**Módulo:** `src/modules/resilience/`  
**Esquema de BD:** `prisma/schema/resilience.prisma`  
**Métricas del Charter:** MTTD $\le 5\text{ s}$, MTTR $\le 60\text{ s}$, Pérdida $\le 0\%$  

---

## 1. Propósito y Alcance

Proveer la infraestructura de resiliencia del sistema: persistencia desacoplada con el patrón **Transactional Outbox**, procesamiento de colas en segundo plano con **`pg-boss`**, política de reintentos con **Exponential Backoff**, derivación a **Dead Letter Queue (DLQ)**, orquestación del patrón **Circuit Breaker** y provisión del **Servidor Mock Interno de Caos** (inyección de errores 503 y retardos) para pruebas reproducibles.

---

## 2. Reglas de Resiliencia y Políticas de Reintento

1. **Transactional Outbox:** El comprobante y el job `send-invoice-sunat` se insertan en la misma transacción ACID de PostgreSQL. Si la base de datos falla, se hace rollback de ambos; si tiene éxito, se garantiza que el comprobante será procesado.
2. **Exponential Backoff:**  
   $$\text{Retardo} = 2^{\text{intento}} \text{ segundos} \quad (2\text{s}, 4\text{s}, 8\text{s}, 16\text{s}, 32\text{s})$$
3. **Límite de Reintentos:** Máximo 5 intentos. Al 5to intento fallido, el job se transfiere a `pgboss.archive` (DLQ) y la factura se marca como `ERROR_RED`.
4. **Patrón Circuit Breaker:**
   * **CLOSED:** Operación normal. Si ocurren 5 fallos HTTP 503 o timeouts consecutivos, pasa a OPEN.
   * **OPEN:** Bloquea llamadas a SUNAT durante 30 segundos. Las peticiones se almacenan en Outbox directamente sin intentar la red.
   * **HALF-OPEN:** Tras 30 segundos, envía 1 petición de prueba. Si es exitosa, vuelve a CLOSED; si falla, retorna a OPEN por otros 30 segundos.
5. **Cálculo de MTTD y MTTR:**
   * $\text{MTTD} = T_{\text{apertura\_circuito}} - T_{\text{primer\_fallo\_503}}$
   * $\text{MTTR} = T_{\text{cola\_vaciada}} - T_{\text{apertura\_circuito}}$

---

## 3. Puertos de Dominio

* `IOutboxQueuePort`:
  - `enqueueJob(name: string, payload: any): Promise<string>`
  - `retryDlqJob(jobId: string): Promise<void>`
* `ICircuitBreakerPort`:
  - `getState(): CircuitBreakerStateEnum`
  - `recordSuccess(): void`
  - `recordFailure(): void`

---

## 4. Casos de Prueba Requeridos

1. Caos: Inyección de HTTP 503 con el Mock interno y verificación de apertura del Circuit Breaker en $\le 5\text{ s}$.
2. Recuperación: Drenaje de la cola tras apagar el fallo y cálculo de MTTR $\le 60\text{ s}$.
