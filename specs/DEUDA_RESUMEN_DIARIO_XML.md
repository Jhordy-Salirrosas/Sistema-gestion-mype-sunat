# Deuda técnica: estructura del XML de resumen diario (RC) y comunicación de baja (RA)

**Estado:** abierto. **Última revisión:** 1 nov 2026.
**Tarea asociada:** TA-67 · **HU-11.**

## Resumen en una línea

El resumen diario y la comunicación de baja **llegan a SUNAT y SUNAT los procesa**, pero el XML
todavía no cumple la secuencia de nodos que exige el esquema. El envío falla en la validación del
`billService` antes de obtener ticket, y la pantalla de Bajas lo dice tal cual (no promete un envío
que no se completa).

## Lo que SÍ está resuelto

| Punto | Estado |
| --- | --- |
| El envío tiene disparador real (`POST /invoices/resumenes/{diario,baja}/enviar`) | ✅ |
| Firma XML → ZIP → cola → `sendSummary` → sondeo de ticket | ✅ |
| Nombre del ZIP y del XML interno coinciden (`{RUC}-RC-AAAAMMDD-NNN.zip` / `.xml`) | ✅ |
| Las notas de crédito a factura ya no bloquean el resumen de boletas | ✅ |
| Namespace `sac:` en `SummaryDocumentsLine` / `VoidedDocumentsLine` | ✅ |
| Regla 2346 (`cbc:ID` con fecha de generación) y regla 2957 (7 días) | ✅ |
| Vista previa honesta: la pantalla muestra el XML que se enviaría | ✅ |

## Lo que falta, con el detalle exacto

El esquema de SUNAT (`SummaryDocumentsLineType`) impone una **secuencia** que ni la guía oficial ni
el ejemplo del Anexo describen. Se descubrió iterando contra BETA, leyendo el mensaje
`cvc-particle`, que nombra el nodo que toca a continuación.

Lo confirmado por el esquema, en este orden:

```
sac:SummaryDocumentsLine
├── cbc:LineID                  1, 2, 3... (número de orden, NO la serie)
├── cbc:DocumentTypeCode        03 / 07 / 08
├── sac:DocumentSerialID        B001
├── sac:StartDocumentNumberID   correlativo
├── sac:EndDocumentNumberID     correlativo
├── cac:AccountingCustomerParty …
├── cac:Status/cbc:ConditionCode
├── sac:TotalAmount             importe total
├── sac:BillingPayment
│   ├── cbc:PaidAmount          base imponible
│   └── cbc:InstructionID       01 (Catálogo 11 = gravado)
└── cac:TaxTotal …
```

Cabecera (`SummaryDocuments`), ya aceptada por el esquema:

```
cbc:UBLVersionID 2.0 · cbc:CustomizationID 1.1 · cbc:ID RC-AAAAMMDD-NNN
cbc:ReferenceDate · cbc:IssueDate
cac:AccountingSupplierParty
├── cbc:CustomerAssignedAccountID   RUC del emisor (NO PartyIdentification)
├── cbc:AdditionalAccountID         6
└── cac:Party/cac:PartyLegalEntity/cbc:RegistrationName
```

## Las tres iteraciones contra BETA (queda registrado para no repetirlas)

| # | Error devuelto | Qué enseñó |
| --- | --- | --- |
| 1 | `Validation Filename error zip name: …; xml name:` | El nombre interno del XML debía ser igual al del ZIP |
| 2 | `INFO: 2217 (nodo: "/")` | Faltaban campos obligatorios; SUNAT no dice cuáles |
| 3 | `cvc-particle 2.1: … found <sac:BillingPayment>, but next item should be <sac:TotalAmount>` | El esquema exige `TotalAmount` antes de `BillingPayment` |
| 4 | `2512 (nodo: "/")` — "No existe información de serie o número" | `LineID` no puede ir antes de `DocumentTypeCode` |
| 5 | `cvc-particle 3.1: … found <cbc:DocumentTypeCode>, but next item should be <cbc:LineID>` | …y con `LineID` movido al final, el esquema lo vuelve a pedir primero |

La iteración 5 es la que dejó el trabajo **detenido**: los dos intentos del límite acordado se
consumieron en las iteraciones 4 y 5, y las dos apuntan en direcciones opuestas. Eso significa que el
problema **no es el orden de esos dos nodos**, sino que hay un nodo intermedio que el esquema espera
y que aún no se ha identificado.

## Por qué no se siguió

Cada intento contra BETA **consume un identificador `RC-AAAAMMDD-NNN`** y dispara hasta cuatro
reintentos de la cola. La decisión del 1 nov fue: máximo dos intentos, y si rebota pidiendo otro nodo,
revertir a la versión estable y dejar el hallazgo aquí.

Se cumplió el criterio: se revirtió `summaryDocumentsBuilder.ts` a su versión estable (la del commit
`e102df4`, sin la reconstrucción) y los 620 tests de facturación quedaron en verde.

## Cómo cerrarla

1. **Obtener el XSD del resumen**, no la guía. La guía enumera campos obligatorios; la secuencia está
   en el `.xsd` (`SummaryDocumentsLineType`), que se puede leer directamente y daría el orden exacto
   en un solo paso en lugar de ir nodo por nodo contra BETA.
2. **O comparar con un resumen aceptado real**: cualquier RC que la empresa haya enviado antes
   (con o sin éxito) sirve para ver el orden de los nodos que SUNAT sí aceptó.
3. Con el orden correcto, ajustar `lineaResumen` y `lineaBaja` en `summaryDocumentsBuilder.ts`, y
   actualizar `ta67-resumenes-diarios-y-bajas.spec.ts`, que hoy fija los nodos de la versión estable.

## Nota sobre el impacto en la entrega

Las facturas, boletas y notas de crédito **sí se emiten y se aceptan** por `sendBill` (código 0):
los comprobantes individuales no pasan por este XML. Lo que todavía no cierra es el envío
**agrupado** de boletas y la anulación por comunicación de baja.
