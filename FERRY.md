# Pulidos M1 — A, B y C

Rama única `fix/m1-pulidos`, desde backend main `c663ea3ee0d3a5c34c97af9993d284a14892da3f`. Base frontend main: `3e4497367363c70d7c774c1d9dc0b65b221a120f`, CarlosSoles/Fronted-sistema-mype-sunat. Un commit de fase 0 y uno por punto. Sin PR, despliegue, emisiones reales ni migraciones.

## Veredictos y comportamiento

- **A, confirmado y construido:** GET /invoices/alertas añade `antiguedad`: estado de evaluación, gravedad, mensaje y documentos con número, tipo, estado, fecha de emisión, fecha límite y días restantes. Solo facturas 01 (3 días) y boletas 03 (7 días), pendientes o en error, de la empresa autenticada. Vencidos primero; hoy/mañana/vencido crítico, resto pendiente aviso. El día persistido no se desplaza por zona horaria y hoy se calcula en Lima. El Monitor muestra diez más urgentes y el total; el endpoint devuelve todos. El resumen de facturación incorpora el motivo nuevo. No hay escrituras, reenvíos ni interpretación de recuperabilidad. No se asignan ventanas a notas/agregados. Fallo de lectura es SIN_DATOS, no una lista vacía evaluada.
- **B, confirmado y construido:** la consulta RUC existente distingue 404/422 (no encontrado) de una respuesta 200 válida con estado inactivo. Solo tras confirmar la emisión se consulta el RUC del receptor, fuera de la transacción y de la respuesta fiscal almacenada por idempotencia, con espera máxima de dos segundos. Estado distinto de ACTIVO y/o NO HABIDO añade avisos sin sustituir los anteriores. Fallo, timeout, no encontrado o datos inválidos devuelven la respuesta confirmada sin aviso nuevo. DNI o tipo extranjero no consultan. Una consulta tardía puede completar la caché existente, pero no modifica la respuesta ya devuelta. La repetición idempotente consulta el aviso nuevamente sin repetir emisión. No se cambian proveedor, variables ni credenciales; las pruebas solo usan dobles.
- **C, premisa precisada y construido:** el guardado de otros campos ya era real. Faltaba RUC editable y envío de `issuer_ruc`. El formulario admite 11 dígitos exactos o vacío (PUT con null para limpiar), muestra RUC efectivo y origen y recarga tras guardar. Mantiene errores de formato/servidor, permisos y coherencia SOL/certificado del backend existente. No cambia el RUC compartido de la empresa ni la sesión. Cuando el origen es company, el campo de pin permanece vacío y el RUC efectivo se presenta aparte. No hay cambio backend para C.

Ningún punto detenido. Las ventanas y etiquetas 2108/2957 son las ya aplicadas por el sistema; este paquete no reinterpreta el catálogo de bajas. La auditoría previa se conserva íntegra y las decisiones se añaden al final de docs/m1/auditoria-solucion.md.

## Archivos por punto

Todas las rutas front siguientes tienen prefijo `frontend/` en esta rama y conservan su ruta relativa en destino.

**A — backend:**

- src/modules/invoices/application/services/invoiceAlertService.ts
- src/modules/invoices/application/services/invoiceSendAge.ts
- test/unit/invoices/pulidosAntiguedad.spec.ts

**A — front:**

- src/modules/invoices/lib/invoiceAlertas.ts
- src/modules/invoices/components/InvoiceSendAgeAlert.tsx
- src/modules/invoices/pages/InvoiceMonitorPage.tsx
- src/modules/invoices/pages/InvoicesDashboardPage.tsx
- test/unit/modules/invoices/pulidosAntiguedad.test.tsx

**B — backend:**

- src/modules/invoices/application/services/atomicInvoiceCreationService.ts
- src/modules/invoices/application/services/receiverRucWarning.ts
- test/unit/invoices/pulidosPadronReceptor.spec.ts

El front ya muestra `avisos` de emisión; B no requiere archivos frontend.

**C — front:**

- src/modules/invoices/components/InvoiceIssuerConfigForm.tsx
- src/modules/invoices/hooks/useInvoiceConfig.ts
- src/modules/invoices/lib/invoiceConfigError.ts
- src/modules/invoices/pages/InvoiceSettingsPage.tsx
- test/unit/modules/invoices/invoiceD1Config.test.tsx
- test/unit/modules/invoices/pulidosRucEmisor.test.tsx

Además: docs/m1/auditoria-solucion.md, FERRY.md y SHA256SUMS. El ajuste de invoiceD1Config sustituye la expectativa de solo lectura por la edición expresamente solicitada, conservando los controles de secretos y guardado parcial.

## Validación

| Verificación | Base | Final |
|---|---:|---:|
| Back: suites aprobadas | 347 | 349 (+2) |
| Back: pruebas aprobadas | 3489 | 3510 (+21) |
| Back: optativas omitidas | 17 suites / 93 pruebas | 17 suites / 93 pruebas |
| Back: snapshots | 12 | 12 |
| Front: archivos aprobados | 177 | 179 (+2) |
| Front: pruebas aprobadas | 1357 | 1367 (+10) |

Las dos suites completas finales terminan sin fallos; el front no tiene omisiones. Builds backend y frontend correctos, ejecutados secuencialmente después de terminar Jest. Lint backend sin errores y tres advertencias heredadas; ESLint de los ocho archivos productivos front tocados sin errores y dos advertencias preexistentes de Fast Refresh del Monitor. No se declara el lint global frontend como verde.

Pruebas dirigidas A: siete nuevas backend y tres front. B: catorce nuevas backend con fetch y persistencia dobles. C: siete nuevas front y actualización de una expectativa existente de solo lectura. Se conserva el resto de las regresiones y snapshots.

## Aplicación del ferry

1. Revisar el diff contra el SHA backend base y ejecutar `sha256sum -c SHA256SUMS` desde la raíz.
2. El directorio frontend/ conserva archivos heredados de los paquetes anteriores. Para este encargo sobre el main front base indicado, aplicar solamente las once rutas front A/C enumeradas, retirando el prefijo frontend/. Ante cambios posteriores, comparar e integrar; se transportan archivos completos.
3. Los 35 archivos presentes bajo frontend/ coinciden con el checkout final probado. El manifiesto contiene hashes de todos ellos, incluidos heredados, y de este documento; no incluye su propio hash.
4. Ejecutar en back `NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand` y en front `npm test`. Después, `npm run build` en cada repositorio sin solapar build y Jest. No habilitar pruebas SUNAT beta ni configurar credenciales reales para las pruebas.
5. Revisar y promover por el tren habitual. Este trabajo no crea PR ni despliega.

No hay dependencias nuevas ni modificaciones de esquema. Para retirar el paquete, revertir sus commits y la aplicación de las once rutas front, sin revertir los paquetes anteriores. No se reescriben documentos históricos ni se reparan datos de producción.
