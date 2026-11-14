# Arreglos de auditorías M1

Rama única `fix/m1-arreglos-auditorias`, desde `fix/m1-pulidos` `10483de7954cdbd41f2436010e09ea1a3669846f`. Sin PR, despliegue, migraciones ni emisiones reales. Pruebas con dobles.

Base frontend reproducida: `CarlosSoles/Fronted-sistema-mype-sunat` `3e4497367363c70d7c774c1d9dc0b65b221a120f` + el ferry completo de esa cabeza de pulidos. Main remoto verificado: `5b9edeece1cc05faae1fc44ddddc5009781b4440`; su avance de cierre de caja no intersecta ninguno de los 42 archivos transportados. Las suites se miden contra la base reproducida sobre pulidos.

## Veredictos

1. Confirmado y corregido: listado y detalle seleccionan Catálogo 09 para 07 y Catálogo 10 para 08 mediante un formateador común. Pruebas de los códigos 01/02/03 en ambos tipos; las vistas comparten los mapeadores.
2. Confirmado y corregido: el individual usa la clasificación masiva antes de la cola y en la relectura. Excluye bloqueo local, rechazo definitivo e incertidumbre. Consulta sin transmisión probada devuelve SIN_TRANSMISION sin consultar SUNAT cuando el marcador false o el bloqueo previo acreditan no envío y no existe evidencia contraria. Una consulta aislada no prueba transporte. Null histórico sin evidencia conserva la protección conservadora del worker. No cambia el reenvío forzado ni el endpoint genérico de DLQ de resiliencia.
3. Confirmado en código y corregido: acción explícita Resolver DLQ en Monitor, POST /invoices/:id/resolver-dlq. Solo ACEPTADO y CDR código 0 de la empresa autenticada. Retira trabajos DLQ pendientes propios del documento; cero trabajos es idempotente. No escribe el documento fiscal ni publica un envío; puentes pendientes conservan su acción separada. Las alertas y filas se actualizan tras resolver. No se inspeccionaron trabajos de producción.
4. Diagnóstico inicial (sustituido por la segunda adenda al final de este documento): 08 Bonificación requiere definir líneas, gratuidad y efectos físicos/monetarios antes de habilitarse; 10 Otros conceptos es viable con alcance restringido al origen y regresión XML, sin asumir cobertura de sus referencias excepcionales. Las notas de boleta BC01/BD01 deben excluirse de RA y anularse por RC. Fuentes oficiales vigentes, guardas y límites en `docs/m1/auditoria-solucion.md`. No se modificaron catálogos habilitados ni RA/RC.

Estado inicial previo a la segunda adenda: puntos 1–3 construidos y punto 4 documentado. Véase la actualización de 4a/4b al final.

## Aplicación del ferry

`frontend/` conserva todos los archivos heredados de pulidos y superpone los de este paquete. Cada ruta es relativa a la raíz del repo frontend; no crear una segunda carpeta frontend en destino. Verificar primero `sha256sum -c SHA256SUMS` en el repo backend y copiar `frontend/.` sobre el checkout frontend. Conservar los demás archivos del destino. Revisar cualquier avance posterior que toque esas rutas antes de aplicar.

`SHA256SUMS` contiene un hash SHA-256 por cada uno de los 42 archivos frontend y por este FERRY.md (43 entradas). No incluye su propio hash. Es el inventario íntegro y verificable del ferry compuesto.

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

## Validación completa

| Capa | Base pulidos | Resultado final |
| --- | --- | --- |
| Back | 349 suites / 3510 pruebas | 351 suites / 3538 pruebas |
| Front | 179 archivos / 1367 pruebas | 179 archivos / 1377 pruebas |

Back: 17 suites / 93 pruebas omitidas en ambas corridas; 12 snapshots aprobados. Incremento neto: 28 pruebas back y 10 front. Suites completas en verde. Build back (`prisma generate` + `nest build`) y front (`tsc -b` + `vite build`) OK. La corrección final de tipos en los dobles del Monitor se verificó además con sus 7 pruebas dirigidas y el build frontend completo.

Las omisiones del back corresponden a suites optativas sin entorno habilitado. Los builds se ejecutan después de terminar Jest y Vitest; no se regenera Prisma mientras Jest lo lee.

## Segunda adenda — 4a

Base: e15caad9. La habilitación completa y conjunta de 08/10 queda detenida: falta una política de unidades bonificadas y el modelo de cálculo no representa un ajuste exclusivo del IGV conservando la base. Los códigos permanecen deshabilitados. El informe SUNAT 057-2025 y la guía UBL precisan el alcance; el documento de auditoría registra contratos, guardas, ejemplo numérico y requisitos para retomarlo. No se confunde viabilidad futura restringida con habilitación completa validada. La exclusión RA del subpunto 4b continúa de forma independiente.
