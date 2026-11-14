# Arreglos de auditorías M1

Rama única `fix/m1-arreglos-auditorias`, desde `fix/m1-pulidos` `10483de7954cdbd41f2436010e09ea1a3669846f`. Sin PR nuevo, despliegue, migraciones ni emisiones reales. Pruebas con dobles.

Base frontend vigente de validación: `CarlosSoles/Fronted-sistema-mype-sunat` main `ebf5e34f2821ee773d7ff23af432443ff2cfe8b8`, con los 55 archivos del ferry superpuestos. El avance desde la base histórica `3e4497367363c70d7c774c1d9dc0b65b221a120f` no intersecta ninguna ruta transportada. Los conteos anteriores se conservan como registro histórico; el cierre de la fusión con dev figura al final.

## Veredictos

1. Confirmado y corregido: listado y detalle seleccionan Catálogo 09 para 07 y Catálogo 10 para 08 mediante un formateador común. Pruebas de los códigos 01/02/03 en ambos tipos; las vistas comparten los mapeadores.
2. Confirmado y corregido: el individual usa la clasificación masiva antes de la cola y en la relectura. Excluye bloqueo local, rechazo definitivo e incertidumbre. Consulta sin transmisión probada devuelve SIN_TRANSMISION sin consultar SUNAT cuando el marcador false o el bloqueo previo acreditan no envío y no existe evidencia contraria. Una consulta aislada no prueba transporte. Null histórico sin evidencia conserva la protección conservadora del worker. No cambia el reenvío forzado ni el endpoint genérico de DLQ de resiliencia.
3. Confirmado en código y corregido: acción explícita Resolver DLQ en Monitor, POST /invoices/:id/resolver-dlq. Solo ACEPTADO y CDR código 0 de la empresa autenticada. Retira trabajos DLQ pendientes propios del documento; cero trabajos es idempotente. No escribe el documento fiscal ni publica un envío; puentes pendientes conservan su acción separada. Las alertas y filas se actualizan tras resolver. No se inspeccionaron trabajos de producción.
4. Punto 4 construido según el alcance aclarado: 10 Otros conceptos habilitado para ajustes monetarios sobre líneas del origen con sustento obligatorio; 08 Bonificación sigue documentado y deshabilitado. BC01/BD01 permanecen excluidas de RA y ahora cuentan con anulación RC explícita (ítem 3), reserva durable, CDR y reversión local idempotente. Véase el cierre vigente al final.

Estado inicial previo a la segunda adenda: puntos 1–3 construidos y punto 4 documentado. Véase la actualización de 4a/4b al final.

## Aplicación del ferry

`frontend/` conserva todos los archivos heredados de pulidos y superpone los de este paquete. Cada ruta es relativa a la raíz del repo frontend; no crear una segunda carpeta frontend en destino. Verificar primero `sha256sum -c SHA256SUMS` en el repo backend y copiar `frontend/.` sobre el checkout frontend. Conservar los demás archivos del destino. Revisar cualquier avance posterior que toque esas rutas antes de aplicar.

`SHA256SUMS` contiene un hash SHA-256 por cada uno de los 55 archivos frontend y por este FERRY.md (56 entradas). No incluye su propio hash. Es el inventario íntegro y verificable del ferry compuesto.

## Archivos de este paquete por punto

Las rutas de frontend siguientes se transportan con el prefijo `frontend/`; el resto vive directamente en el backend. El documento de auditoría y el manifiesto se actualizan de forma transversal.

### 1 — Motivo de nota

- frontend/src/modules/invoices/lib/invoiceMapper.ts
- frontend/src/modules/invoices/lib/invoiceNoteReason.ts
- frontend/test/unit/modules/invoices/invoiceMapper.test.ts

### 2 — Reintento y consulta

- frontend/src/modules/invoices/components/InvoiceSunatConsulta.tsx
- frontend/src/modules/invoices/services/invoicesApi.ts
- frontend/test/unit/modules/invoices/invoiceConsultaSunat.test.tsx
- src/modules/invoices/application/services/invoiceBatchRetryService.ts
- src/modules/invoices/application/services/invoiceQueryService.ts
- src/modules/invoices/application/services/invoiceTransportEvidence.ts
- src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController.ts
- test/unit/invoices/invoiceIndividualRetryPolicy.spec.ts
- test/unit/invoices/m1-incertidumbre-transporte.spec.ts
- test/unit/invoices/m1-rescate-manual.spec.ts

### 3 — Resolución DLQ

- frontend/src/modules/invoices/pages/InvoiceMonitorPage.tsx
- frontend/src/modules/invoices/services/invoicesApi.ts
- frontend/test/unit/modules/invoices/invoiceMonitorReal.test.tsx
- src/modules/invoices/application/services/invoiceQueryService.ts
- src/modules/invoices/infrastructure/controllers/invoiceQueryController.ts
- src/modules/resilience/infrastructure/queue/queue.service.ts
- test/unit/invoices/invoiceAcceptedDlq.spec.ts

### 4 — Diagnóstico y cierre

- docs/m1/auditoria-solucion.md
- FERRY.md
- SHA256SUMS

## Validación anterior a la segunda adenda

| Capa | Base pulidos | Resultado final |
| --- | --- | --- |
| Back | 349 suites / 3510 pruebas | 351 suites / 3538 pruebas |
| Front | 179 archivos / 1367 pruebas | 179 archivos / 1377 pruebas |

Back: 17 suites / 93 pruebas omitidas en ambas corridas; 12 snapshots aprobados. Incremento neto: 28 pruebas back y 10 front. Suites completas en verde. Build back (`prisma generate` + `nest build`) y front (`tsc -b` + `vite build`) OK. La corrección final de tipos en los dobles del Monitor se verificó además con sus 7 pruebas dirigidas y el build frontend completo.

Las omisiones del back corresponden a suites optativas sin entorno habilitado. Los builds se ejecutan después de terminar Jest y Vitest; no se regenera Prisma mientras Jest lo lee.

## Segunda adenda — 4a

Base: e15caad9. La habilitación completa y conjunta de 08/10 queda detenida: falta una política de unidades bonificadas y el modelo de cálculo no representa un ajuste exclusivo del IGV conservando la base. Los códigos permanecen deshabilitados. El informe SUNAT 057-2025 y la guía UBL precisan el alcance; el documento de auditoría registra contratos, guardas, ejemplo numérico y requisitos para retomarlo. No se confunde viabilidad futura restringida con habilitación completa validada. La exclusión RA del subpunto 4b continúa de forma independiente.

## Segunda adenda — 4b construido

La norma vigente excluye de RA las notas vinculadas a boletas. Se aplica la guarda común en elegibilidad, construcción XML y comprobación previa al primer despacho: BC01/BD01 quedan fuera; FC01/FD01 permanecen sujetas a las demás reglas. También se excluye una serie F inconsistente cuyo documento afectado sea boleta (por tipo 03 o referencia B). Los tickets ya existentes conservan la consulta, sin reenviar ni modificar el documento fiscal.

El front deshabilita las notas de serie B, indica que corresponden a RC y elimina de la selección efectiva cualquier fila que deje de ser elegible. No incorpora aquí un flujo nuevo de anulación RC.

Archivos adicionales de 4b:

- src/modules/invoices/application/services/summaryDocumentsBuilder.ts
- src/modules/invoices/application/services/invoiceSummaryService.ts
- src/modules/invoices/application/services/summaryDispatchDeadline.ts
- test/unit/invoices/raBoletaNotes.spec.ts
- test/unit/invoices/consolidado-ra-deadline.spec.ts
- test/unit/invoices/fiscalDate.spec.ts
- frontend/src/modules/invoices/components/EnviarBajaPanel.tsx
- frontend/test/unit/modules/invoices/invoiceBajaEnvio.test.tsx

Los dos archivos front se añaden al ferry heredado: 44 archivos frontend más FERRY.md, 45 entradas SHA-256. El documento de auditoría conserva el historial previo y añade los veredictos definitivos de la segunda adenda: 4a detenido y 4b construido.

## Validación final de la segunda adenda

| Capa | Base de adenda e15caad9 | Final |
| --- | --- | --- |
| Back | 351 suites / 3538 pruebas | 352 suites / 3549 pruebas |
| Front | 179 archivos / 1377 pruebas | 179 archivos / 1382 pruebas |

Suites completas verdes; back mantiene 17 suites / 93 pruebas omitidas y 12 snapshots aprobados. Builds completos back y front OK, posteriores a ambas suites. Incremento de la adenda: 11 pruebas back y 5 front. Veredicto definitivo: 4a detenido por los límites de ajuste fiscal/unidades documentados; 4b construido en elegibilidad, XML, primer despacho y front. Dos commits adicionales, uno por subpunto, en la misma rama. Sin PR, migraciones ni emisiones reales. Ferry compuesto: 44 archivos frontend y FERRY.md, 45 entradas SHA-256 verificadas.

## Adenda menor — Bajas y Monitor

Base 58b3d533. Los tres ítems son menores y quedan construidos en un único commit adicional, solo front/documentos:

- Motivo de baja vacío: mensaje obligatorio junto al campo, enlazado de forma accesible; se conserva el bloqueo de Ver XML hasta completarlo.
- Cola y agregados: última actualización exitosa en HH:mm:ss de Lima. Los errores no adelantan la marca; se conserva el último éxito.
- Comprobantes en vuelo: columnas proporcionadas, texto/badges/botones ajustables y Acción visible sin desplazamiento lateral en las comprobaciones de 1280/1024 px, con margen lateral de 256 px y textos largos. Tipo de comprobante bajo el número usando el dato existente, sin llamada adicional. No se cambian componentes globales.

Archivos de esta adenda (rutas relativas al frontend, bajo frontend/ en el ferry):

- src/modules/invoices/components/EnviarBajaPanel.tsx
- src/modules/invoices/components/InvoiceLastUpdated.tsx
- src/modules/invoices/components/InvoiceAggregateMonitor.tsx
- src/modules/invoices/pages/InvoiceMonitorPage.tsx
- test/unit/modules/invoices/invoiceBajaEnvio.test.tsx
- test/unit/modules/invoices/invoiceMonitorRetry.test.tsx
- test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx

El ferry compuesto contiene ahora 48 archivos frontend más FERRY.md, con 49 entradas SHA-256. La última sección del documento de auditoría registra los veredictos y las medidas de Chromium. No se transporta el montaje visual temporal. El subpunto 4a conserva su detención documentada; esta adenda no cambia sus catálogos ni el backend.

## Validación final de la adenda menor

| Capa | Base 58b3d533 | Cierre |
| --- | --- | --- |
| Front | 179 archivos / 1382 pruebas | 179 archivos / 1387 pruebas |
| Back (sin cambios) | 352 suites / 3549 pruebas | misma última corrida verde |

Suite completa del front verde, cinco pruebas adicionales. Tras corregir una opción no admitida por los tipos de la consulta de elementos en las pruebas, se repitieron las 14 pruebas del Monitor afectado y el build completo (tsc -b + vite), ambos aprobados. Esa corrección conserva el comportamiento predeterminado de coincidencia del nombre del botón. El back conserva su build y su última suite de la adenda anterior; no se vuelven a ejecutar al no cambiar código ni dependencias del servidor. Conserva 17 suites / 93 pruebas omitidas y 12 snapshots aprobados.

Ferry: 48 archivos frontend coincidentes con el checkout validado, más FERRY.md; 49 entradas SHA-256 verificadas. Un único commit adicional para los tres ítems menores en la misma rama. Sin PR, migraciones ni emisiones reales.

## Corrección CI del PR #388 — YA_EN_COLA

Base 37de84ea. La integración de rescate DLQ se reprodujo fallando en el segundo clic: el marcador de incertidumbre persistido por el primer rescate ocultaba el trabajo ya publicado. Antes de aplicar esa exclusión, el individual comprueba trabajos vivos en EN_COLA/PENDIENTE/ERROR_RED/ENVIADO. Con un job created/retry/active responde YA_EN_COLA y encolado=false sin modificar ni publicar nada. Sin job vivo conserva la exclusión. Bloqueos locales, estados finales/PROCESANDO y clasificación masiva permanecen iguales.

Archivos de la corrección:

- src/modules/invoices/application/services/invoiceQueryService.ts
- test/unit/invoices/invoiceIndividualRetryPolicy.spec.ts
- test/integration/invoices/pulidoDlq.integration.spec.ts
- docs/m1/auditoria-solucion.md
- FERRY.md
- SHA256SUMS

Se añaden 14 pruebas unitarias y se refuerza la integración para conservar la incertidumbre y comprobar un único trabajo. El front no cambia; sus 48 archivos transportados se conservan exactamente. La suite back se ejecuta con TEST_DATABASE_URL en una base local nueva, aplicando solo las migraciones existentes; no se crean migraciones ni se modifica una base compartida.

## Validación final de la corrección CI #388

| Capa | Última ejecución anterior | Ejecución de cierre |
| --- | --- | --- |
| Back | 352 suites / 3549 pruebas; 17 suites / 93 pruebas omitidas | 365 suites / 3618 pruebas; 4 suites / 38 pruebas omitidas |
| Front | 179 archivos / 1387 pruebas | 179 archivos / 1387 pruebas |

Ambas suites completas aprobadas. Back conserva 12 snapshots. El incremento back se descompone en 14 pruebas nuevas y 55 pruebas previamente omitidas que ahora se ejecutan al habilitar PostgreSQL; no son 69 pruebas nuevas. Los conteos corresponden al checkout de esta rama. La regresión de DLQ que fallaba en CI está incluida y aprobada. Lint y builds completos back/front OK, posteriores a las suites para evitar regeneración concurrente de Prisma. Los 48 archivos front no cambian; el manifiesto conserva 49 entradas (incluido FERRY.md), verificadas. Un commit de corrección en la misma rama, sin abrir PR ni realizar emisiones reales.

## Cierre vigente — terminación de las adendas

La cabeza remota 70dd9fd7 ya incluía los menores (37de84ea), la exclusión de RA (58b3d533) y YA_EN_COLA (70dd9fd7), con su código frontend transportado. Se conservan esos commits y se completa el bloque pendiente del punto 4 en un commit adicional, sin PR nuevo.

- **10 construido, restringido:** ajuste monetario positivo sobre líneas de factura/boleta origen, mismo receptor, unidad/afectación y control de cantidades/saldo vigentes. Sustento específico obligatorio, editable en el formulario. XML CreditNoteLine y ResponseCode 10, probado con ambas rutas y hojas oficiales. No habilita rectificación exclusiva de IGV, líneas nuevas ajenas, referencias sin origen ni otros tratamientos especiales del código 10.
- **08 solo documentado:** requiere definir consumo de unidades bonificadas y su tratamiento; no se habilita.
- **RC de anulación construido:** pestaña Anulación de notas (RC), selección BC01/BD01 aceptadas/observadas, motivo, XML de ítem 3 y confirmación de no otorgamiento al receptor. FC01/FD01 conservan la vía RA. Ventana de siete días desde aceptación acreditada, revalidada antes del primer despacho. Si falta evidencia de fecha, se informa la exclusión. Una lectura, vista previa o reserva no cambia el documento fiscal.
- **Persistencia y aceptación:** fingerprint separado del alta RC, locks y snapshot de la operación. Se recuperan reservas sin cambiar su modo; no se duplican cancelaciones. Solo el CDR aceptado y consistente con snapshot/XML cambia la nota a ANULADO y registra trabajo local durable para invertir movimientos/asientos reales. El rechazo no anula, y repetir CDR/reversión no duplica efectos. No se reenvía el comprobante individual.

Se reutilizan las tablas/JSON y mecanismos existentes; no hay migraciones nuevas. La reversión pendiente continúa visible y se reprocesa localmente. Las fuentes SUNAT del Catálogo 19, resumen diario y no otorgamiento están enlazadas en docs/m1/auditoria-solucion.md.

Archivos de este bloque:

- frontend/src/modules/invoices/components/EnviarBajaPanel.tsx
- frontend/src/modules/invoices/components/InvoiceAggregateMonitor.tsx
- frontend/src/modules/invoices/components/InvoiceEmitCampos.tsx
- frontend/src/modules/invoices/lib/invoiceEmitValidation.ts
- frontend/src/modules/invoices/lib/invoiceNotaOrigen.ts
- frontend/src/modules/invoices/pages/InvoiceBajasPage.tsx
- frontend/src/modules/invoices/services/invoicesApi.ts
- frontend/test/unit/modules/invoices/invoiceBajaEnvio.test.tsx
- frontend/test/unit/modules/invoices/invoiceBajasRace.test.tsx
- frontend/test/unit/modules/invoices/invoiceNotaOrigen.test.ts
- frontend/test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx
- frontend/test/unit/modules/invoices/p9-close.test.tsx
- src/modules/invoices/application/services/invoiceNoteService.ts
- src/modules/invoices/application/services/invoiceResultPresentation.ts
- src/modules/invoices/application/services/invoiceSummaryService.ts
- src/modules/invoices/application/services/noteCatalogs.ts
- src/modules/invoices/application/services/noteDescription.ts
- src/modules/invoices/application/services/noteReasonGuard.ts
- src/modules/invoices/application/services/raBridgeReversalService.ts
- src/modules/invoices/application/services/summaryAggregateStore.ts
- src/modules/invoices/application/services/summaryCancellation.ts
- src/modules/invoices/application/services/summaryDispatchDeadline.ts
- src/modules/invoices/application/services/summaryDispatchService.ts
- src/modules/invoices/application/services/summaryDocumentsBuilder.ts
- src/modules/invoices/application/services/summaryEnvioService.ts
- src/modules/invoices/infrastructure/controllers/invoiceQueryController.ts
- test/integration/invoices/rcCancellation.integration.spec.ts
- test/unit/invoices/8b-motivos-importes.spec.ts
- test/unit/invoices/otrosConceptosRestringido.spec.ts
- test/unit/invoices/rcCancellation.spec.ts

El ferry compuesto contiene ahora 55 archivos frontend más FERRY.md, 56 entradas SHA-256. Conserva los menores y todos los archivos heredados; aplicar frontend/. sobre el checkout destino conforme a las instrucciones iniciales. La entrega en esta rama es código backend y ferry: no implica despliegue ni aplicación automática en el repositorio frontend.

## Validación final del bloque completado

| Capa | Base remota 70dd9fd7 | Cierre |
| --- | --- | --- |
| Back con PostgreSQL | 365 suites / 3618 pruebas | 368 suites / 3653 pruebas |
| Front | 179 archivos / 1387 pruebas | 179 archivos / 1391 pruebas |

Suites completas verdes, incluidas las integraciones de YA_EN_COLA y de anulación RC; back mantiene 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Incremento: 35 pruebas back y 4 front. Las únicas expectativas antiguas ajustadas fijaban el conjunto de motivos sin el 10 en back/front; 08 permanece excluido. Lint y builds completos back/front OK. El build final se ejecutó después de las suites, sin regeneración Prisma concurrente con Jest.

Estado final: menores aplicados en 37de84ea; exclusión BC01/BD01 de RA en 58b3d533; YA_EN_COLA en 70dd9fd7; este bloque completa 10 restringido y la anulación RC. 08 queda solo documentado conforme al alcance. Se entrega un único commit adicional del bloque pendiente, sin duplicar los bloques ya aplicados ni abrir otro PR. El ferry tiene 55 archivos frontend más FERRY.md (56 entradas SHA-256 verificadas). Su aplicación al repo frontend y despliegue siguen a cargo del tren de revisión. Sin migraciones nuevas ni emisiones reales.


## Fusión con dev para PR #388 — 2026-11-14

Se fusiona dev `bf60df93c2f3434225e7d89acf90b4436c31f7fb` sobre la cabeza `c4e4a3c920afbabb415f220711ee8c5968476ecc`. El único conflicto textual, en invoiceSummaryService.ts, conserva la exclusión BC01/BD01 de RA y la restricción contable de período cerrado/PLE. Esa restricción se comparte con la anulación RC de notas, con ocho regresiones adicionales. La cola conserva tanto SIRE como la resolución DLQ y YA_EN_COLA. Los módulos de Contabilidad y sus módulos relacionados permanecen idénticos a dev.

El ferry no cambia ningún archivo frontend. La base de validación vigente es main `ebf5e34f2821ee773d7ff23af432443ff2cfe8b8`, sin intersección entre sus avances y las 55 rutas transportadas.


### Validación de la fusión

| Capa | Cierre anterior c4e4a3c9 | Fusión con dev actual |
| --- | --- | --- |
| Back, PostgreSQL local | 368 suites / 3653 pruebas | 401 suites / 4034 pruebas |
| Front | 179 archivos / 1391 pruebas | 182 archivos / 1404 pruebas |

Suites completas verdes. Back mantiene 4 suites y 38 pruebas omitidas y 12 snapshots aprobados. El incremento incorpora las pruebas de dev y ocho regresiones de esta resolución; front incorpora las pruebas del main vigente, sin modificar archivos transportados. Las seis suites dirigidas previas pasaron 127 pruebas. Lint backend y builds backend/frontend OK; los builds se ejecutaron después de finalizar ambas suites.

El manifiesto conserva 56 entradas: 55 archivos frontend sin cambios y FERRY.md actualizado. No hay migraciones nuevas, emisiones reales ni PR nuevo.
