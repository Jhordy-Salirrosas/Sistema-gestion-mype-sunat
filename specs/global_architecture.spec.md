# Especificación Global de Arquitectura y Restricciones del Sistema

**Proyecto:** SYNC-SUNAT  
**Autor:** Carlos Ahumada Soles (Arquitecto de Software)  
**Versión:** 1.0.0  
**Fecha:** 13 de Octubre de 2026  

---

## 1. Restricciones Técnicas Globales (SLAs del Project Charter)

| Restricción / Métrica | Valor Objetivo | Mecanismo de Garantía Arquitectónica |
|---|---|---|
| **Latencia de Respuesta en Ingesta** | $\le 500\text{ ms}$ (P95 $\le 1000\text{ ms}$) | Ingesta HTTP asíncrona desacoplada mediante Transactional Outbox + `pg-boss`. |
| **Throughput Mínimo** | $\ge 5\text{ ops/s}$ | Proceso stateless en NestJS capaz de atender $\ge 1,500\text{ req/s}$ I/O-bound. |
| **Tiempo de Encolado Asíncrono** | $\le 3\text{ s}$ | Inserción atómica en la misma transacción de PostgreSQL (`prisma.$transaction`). |
| **Tasa de Pérdida de Transacciones** | $0\%$ (Meta Charter: $\le 1\%$) | Patrón Transactional Outbox con persistencia previa a la confirmación HTTP. |
| **Tiempo Medio de Detección (MTTD)** | $\le 5\text{ s}$ | Circuit Breaker con apertura automática tras 5 fallos consecutivos de red. |
| **Tiempo Medio de Recuperación (MTTR)** | $\le 60\text{ s}$ | Drenaje automático de colas con Exponential Backoff tras restablecimiento de SUNAT. |
| **Consumo de Memoria RAM Backend** | $\le 80\text{ MB}$ en reposo | Monolito ejecutable liviano en NestJS alojado en Render (Free Tier). |
| **Presupuesto de Infraestructura** | Costo \$0.00 / mes | Pila económica y ligera: Render + Supabase PostgreSQL + Vercel SPA. |

---

## 2. Aislamiento Multi-Tenant y Seguridad

1. **Anti-IDOR:** Toda consulta o mutación debe recibir el `company_id` validado criptográficamente desde el token JWT. Prohibido recibir `company_id` por parámetros de ruta o cuerpo de petición.
2. **Cifrado de Secretos (AES-256-GCM):** Clave SOL y certificados digitales de las MYPES se cifran antes de ingresar a la base de datos.
3. **Pista de Auditoría:** Toda mutación tributaria emite un registro inmutable en `audit_logs` con hash encadenado SHA-256.

---

## 3. Principio de Tamaño de Archivos y Clean Code (< 150 - 200 líneas)

* Ningún archivo de TypeScript en el proyecto debe superar las **150 a 200 líneas**.
* El tamaño promedio esperado de una clase o caso de uso es de **40 a 90 líneas**.
* Si un archivo supera las 150 líneas, debe descomponerse en DTOs, Value Objects, Reglas matemáticas o Adaptadores independientes.
