# M1 · Error de bandeja en el modal existente

## Base y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta: `main`, `d15cbb9f1d06c6208eba882f68a8d9100b1e10a8` (merge del PR #380).
- Rama front sugerida: `fix/m1-bandeja-error-en-modal`.
- Commit local del cambio: `02dda3d30b9a9a1ae218af5f83302dec43525367`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Rama ferry: `ferry/m1-bandeja-error-en-modal`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.

## Archivos y diff

Copiar únicamente los siete archivos bajo `frontend/`, conservando sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | 4 | 1 |
| `src/modules/invoices/components/InvoiceIssueGuidance.tsx` | 1 | 1 |
| `src/modules/invoices/components/InvoiceIssueSummary.tsx` | 14 | 0 |
| `src/modules/invoices/components/InvoiceTableRow.tsx` | 2 | 2 |
| `src/modules/invoices/pages/InvoiceMonitorPage.tsx` | 7 | 2 |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | 24 | 1 |
| `test/unit/modules/invoices/invoiceMonitorReal.test.tsx` | 16 | 0 |
| **Total** | **68** | **7** |

`FERRY.md` y `SHA256SUMS.txt` son documentos del transporte y no forman parte del cambio a producción. El manifiesto contiene los siete archivos del front y este documento. Verificar desde la raíz con `sha256sum -c SHA256SUMS.txt`.

## Sitios revisados y tratados

1. **Facturas** (`/invoices/facturas`, tipo 01): `InvoiceList → InvoiceTable → InvoiceTableRow`. La celda conserva InvoiceStatusBadge y, bajo RECHAZADO, muestra el mensaje de orientación en una sola línea con elipsis y Ver detalle. El botón detiene la propagación y llama al `onVerXml(c)` existente.
2. **Boletas** (misma ruta, tipo 03): el mismo cambio de fila compartida; mismo modal y handler.
3. **Notas de crédito** (`/invoices/notas`, tipo 07): la misma fila y apertura del modal existente.
4. **Notas de débito** (`/invoices/notas`, tipo 08): la misma fila y apertura del modal existente.
5. **Vista combinada** (`/invoices/facturas?incluir_notas=1`): utiliza la misma grilla, por lo que conserva los cuatro tipos y aplica el mismo resumen. La configuración genérica con acciones de InvoiceTable también reutiliza esa fila y su handler, sin cambios de acciones, ordenación ni paginación.
6. **Monitor**, Comprobantes en vuelo (`/invoices/monitor`): era el otro listado con InvoiceIssueGuidance en línea. Conserva exactamente su condición de visibilidad (`enDlq` o estado backend ERROR_RED/RECHAZADO), código y orientación. Sustituye ese bloque por el mismo resumen y Ver detalle. Como el Monitor no tenía una entrada al visor, incorpora únicamente estado local de apertura y reutiliza `InvoiceCdrModal` con `aComprobanteDemo`, el adaptador existente. El motivo operativo independiente, las etiquetas DLQ y las acciones de cola se conservan.
7. **Detalle existente**, `InvoiceCdrModal`: ya mostraba InvoiceIssueGuidance completo para RECHAZADO antes de las pestañas Auditoría CDR / Visor XML UBL 2.1. No se duplica ni se crea otro modal. Se permite pasar al mismo visor la orientación que antes mostraba el Monitor, también para sus casos operativos no rechazados; se muestra un solo bloque. La presentación del motivo ahora respeta saltos de línea y permite envolver texto largo sin cortarlo.

La búsqueda global no encontró otros usos de InvoiceIssueGuidance en listados ni otros consumidores de InvoiceTable fuera de InvoiceList. Tras el cambio, el contenido completo de InvoiceIssueGuidance permanece en el visor, no en las filas.

## Alcance preservado

No se modificaron InvoiceStatusBadge, la librería `invoiceErrorGuidance`, la clasificación de bandeja, InvoiceTable, InvoiceList, servicios, endpoints ni llamadas de API. Los códigos y motivos usan las mismas prioridades de campos que antes. Abrir el detalle desde el Monitor ejecuta las lecturas que ya realiza el visor existente; no incorpora un servicio o una consulta nuevos. No hay reenvíos ni escrituras desde Ver detalle.

Se compararon con la base las declaraciones del Monitor para estados en vuelo, clasificación, DLQ, filtros, carga, reintento, resolución DLQ y reproceso: permanecen idénticas. Las filas no rechazadas de la bandeja no reciben orientación ni botones nuevos. Los badges conservan textos, colores e íconos; las etiquetas largas mantienen su ajuste de línea original, sin truncarse.

## Verificaciones

- Suite dirigida: 3 archivos / 54 pruebas en verde. Se prueba el flujo real de InvoiceList y su modal para 01, 03, 07 y 08; ausencia de motivo, acción y detalle técnico en la fila; resumen y botón; modal único con orientación completa y código; filas ACEPTADO, OBSERVADO, EN_COLA y ERROR_RED sin controles nuevos; y apertura del mismo visor desde Monitor para rechazo, incertidumbre y aceptado en DLQ.
- `npm test`: 227 archivos / 1699 pruebas en verde (278,85 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- Lint: base y cambio presentan 216 errores y 27 advertencias; sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Chromium con InvoiceList, AppLayout y el visor reales, a 1440 px, mediante respuestas locales simuladas y escrituras deshabilitadas: nueve columnas; **F001-00000079 mide 64,5 px**, igual que la fila aceptada de referencia (64,5 px). El resumen usa `white-space: nowrap` y `text-overflow: ellipsis`. La etiqueta larga de preparación local conserva su envoltura y puede ocupar más altura, según su texto preexistente; no se cambia el badge para forzar una altura fija.
- Modal de F001-00000079: una sola ventana y una sola orientación; mensaje «El comprobante requiere revisión.»; acción literal de la librería; motivo 3105 completo con ticket 1794529417139 y nodo/valor; Ver detalle técnico despliega «Código: 3105». El motivo tiene ancho visible y desplazable de 736 px, altura visible y desplazable de 40 px: sin recorte. Inspección visual de las capturas de bandeja y modal.

Sin cambios de back, emisiones reales, despliegue, PR ni push al repositorio front.
