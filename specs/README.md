# Guía de Spec-Driven Development (SDD) para SYNC-SUNAT

**Metodología:** Desarrollo Guiado por Especificaciones para Asistencia de Inteligencia Artificial  
**Autor:** Carlos Ahumada Soles (Arquitecto de Software)  
**Proyecto:** SYNC-SUNAT  

---

## 1. ¿Qué es Spec-Driven Development (SDD)?

Spec-Driven Development es una disciplina de ingeniería donde **ningún código de producción ni prueba automatizada se escribe antes de contar con un archivo de especificación formal inmutable** en la carpeta `specs/`.

### El Problema que Resuelve en el Trabajo con IA
Cuando se solicita código a modelos de Inteligencia Artificial (Copilots, LLMs, Agentes) sin un marco de referencia estricto:
* La IA inventa campos, tipos de datos y reglas arbitrarias (*Alucinación*).
* Mezcla capas de arquitectura (coloca SQL o librerías de terceros dentro del dominio puro).
* Genera código de más de 200 líneas saturando servicios en lugar de crear clases atómicas (violando SRP/SOLID).

### Cómo Funciona en SYNC-SUNAT
1. Cada módulo tiene un archivo de especificación técnica (`m1_invoices.spec.md`, `m2_resilience.spec.md`, `m3_customs.spec.md`, etc.).
2. Cada archivo `.spec.md` define de forma matemática e inequívoca:
   - Reglas de negocio puras y fórmulas exactas (ej. Cálculo CIF, Ad-Valorem, Partida Doble).
   - Contratos de entrada y salida (DTOs y Value Objects).
   - Puertos de Dominio (Interfaces abstractas).
   - Códigos de estado HTTP y taxonomía de errores (RFC 7807 y familias de SUNAT).
   - Casos de prueba requeridos (Unitarios, Integración, E2E y Caos).
3. Al interactuar con la IA, se referencia la especificación correspondiente:
   > *"Implementa el caso de uso `RegisterDuaUseCase` siguiendo estrictamente `specs/m3_customs.spec.md` y respetando el límite de 150 líneas por archivo."*

---

## 2. Mapa de Especificaciones del Repositorio

| Archivo | Bounded Context | Responsable | Alcance Técnico |
|---|---|---|---|
| [`global_architecture.spec.md`](./global_architecture.spec.md) | Transversal | Carlos Ahumada | Restricciones globales, SLAs ($\le 500\text{ ms}$), Multi-Tenancy y seguridad. |
| [`m1_invoices.spec.md`](./m1_invoices.spec.md) | M1: Facturación | Jhordy Salirrosas | Emisión UBL 2.1, notas de crédito, firma XMLDSig X.509 y CDR. |
| [`m2_resilience.spec.md`](./m2_resilience.spec.md) | M2: Resiliencia | Oliver Saldaña | Transactional Outbox, `pg-boss`, Mock de Caos 503, DLQ, Circuit Breaker. |
| [`m3_customs.spec.md`](./m3_customs.spec.md) | M3: Aduanas | Carlos Ahumada | Despacho DUA/DAM, Casilla 4 DAM, CIF, tributos, Landed Cost y Kardex. |
| [`m4_sire.spec.md`](./m4_sire.spec.md) | M4: SIRE | Diego Toledo | Propuestas RVIE/RCE, Código CAR, cruce masivo y 4 estados de auditoría. |
| [`m5_accounting.spec.md`](./m5_accounting.spec.md) | M5: Contabilidad | Michael Velásquez | Asientos automáticos PCGE, partida doble ($Debe = Haber$) y PLE TXT. |

---

## 3. Reglas de Inmutabilidad para Desarrolladores y Agentes

1. **Prioridad de la Especificación:** Si hay discrepancia entre una sugerencia de código y la especificación `.spec.md`, **la especificación prevalece**.
2. **Modificación de Especificaciones:** Solo se modifican especificaciones si cambia una resolución oficial de SUNAT o por acuerdo formal del equipo de arquitectura.
3. **Límite de Líneas:** Todo archivo generado a partir de una especificación debe tener un tamaño promedio de 40 a 90 líneas, con un límite máximo estricto de **150 a 200 líneas**.
