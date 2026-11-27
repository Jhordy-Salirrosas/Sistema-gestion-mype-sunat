# M1 · Advertencia de plazo del depósito de detracción

## Bases y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`, base `main` en `3da3c90780a5536a2ed83b4258559862d99ee666`.
- Rama front sugerida: `fix/m1-detracciones-plazo-legal`.
- Commit local del cambio: `7fcc9619cc0a90bf01c47777b0cad7e3e7f400e4`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-detracciones-plazo-legal`.
- Base del transporte: `07ea5ff9d87b68512209f5da8a2ed862edd94268`.

## Verificación previa del contrato

El listado existente `GET /invoices/detractions` devuelve `date` como fecha de emisión. Se confirmó tanto en la interfaz Detraccion de la página como en `InvoiceDetractionService.list` del back (`src/modules/invoices/application/services/invoiceDetractionService.ts`), que asigna `date: f.fecha_emision`. También devuelve las fechas de `deposits[]` y `depositedAt` para registros históricos. No faltan datos indispensables para la regla solicitada ni se requieren endpoints nuevos. La comprobación fue de código, sin consultas de producción ni cambios de back.

## Regla y límite de la referencia

Se calcula el quinto día de lunes a viernes del mes siguiente al de emisión, sin descontar feriados. La comparación es estricta: el propio día límite está en plazo. Se conserva el día calendario de las fechas ISO y se usa hoy en America/Lima para los pendientes. Las fechas inválidas no generan un vencimiento inventado.

La regla está documentada en el código como referencia de los Anexos 2 y 3 de la R.S. 183-2004/SUNAT. Por alcance del encargo, se usa emisión como referencia: el listado no contiene fecha de pago ni anotación en el Registro de Compras. Por tanto, este cálculo no certifica el vencimiento legal individual ni evalúa un plazo anterior por pago/anotación; tampoco descuenta feriados. La interfaz y la advertencia explican estos límites. Referencias normativas aportadas en el encargo: R.S. 183-2004/SUNAT, arts. 11 y 16, y TUO del D. Leg. 940, art. 12.2.

La píldora neutra Fuera de plazo aparece si hay saldo pendiente y hoy supera el límite, o si cualquiera de los movimientos tiene fecha posterior al límite. Si no existen movimientos, se revisa la fecha histórica depositedAt. Los depósitos completos oportunos no se marcan; los parciales con saldo vencido sí.

Registrar y Editar muestran una advertencia visible cuando la fecha elegida supera el límite, con la fecha de referencia, la posible multa del 50 % del importe no depositado oportunamente y la postergación del crédito fiscal. Es informativa: no participa en disabled ni en las validaciones o la mutación de guardado.

## Archivos transportados

Copiar los cuatro archivos bajo `frontend/` a sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/lib/invoiceDetractionDeadline.ts` | 41 | 0 |
| `src/modules/invoices/pages/InvoiceDetractionsPage.tsx` | 12 | 1 |
| `test/unit/modules/invoices/invoiceDetractionDeadline.test.ts` | 32 | 0 |
| `test/unit/modules/invoices/invoiceDetractionDeadlineUi.test.tsx` | 63 | 0 |
| **Total** | **148** | **1** |

`FERRY.md` y `SHA256SUMS` son documentos del transporte y no forman parte del cambio a producción. El manifiesto incluye los cuatro archivos del front y este documento. Verificar con `sha256sum -c SHA256SUMS` desde la raíz de la rama.

## Verificaciones

- Suite dirigida: **4 archivos / 43 pruebas en verde**. Incluye fines de semana, cambio de año, año bisiesto, primer día del mes en fin de semana, feriado contado como día de lunes a viernes, fechas inválidas, límite inclusivo y medianoche en Lima. También pendientes, parciales, varios movimientos, depósitos completos oportunos/tardíos y datos históricos.
- Registrar y Editar: pruebas de advertencia visible, desaparición al elegir el día límite, botón habilitado y POST/PUT con monto, fecha y constancia intactos.
- `npm test`: 230 archivos / 1719 pruebas en verde (257,88 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- Lint: base y cambio presentan 216 errores y 27 advertencias; sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Comparación de las declaraciones de consulta, saldo, resumen de importes, validaciones, mutación y apertura del editor contra la base: idénticas. No se alteran montos, constancias, movimientos, payloads, auditoría ni otros módulos.
- Chromium a 1440 px, con el componente real y respuestas locales simuladas: para una emisión de octubre de 2026, referencia 06/11/2026; se marca el pendiente vencido y un depósito de 09/11, pero no el depósito de 06/11. La advertencia es legible y Guardar depósito permanece habilitado. Se comprobó el registro POST y la edición PUT mediante dobles locales, sin emisiones ni escrituras de producción. Captura de la advertencia generada e inspeccionada.

Sin PR, despliegue ni push al repositorio front. El back se usa únicamente como transporte.
