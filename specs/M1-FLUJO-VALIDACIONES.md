# M1: validaciones y hallazgos de flujo (auditoría 2)

## Validaciones previas por interfaz

| Regla | Formulario de factura/boleta | Diálogo de notas |
| --- | --- | --- |
| Fecha de emisión | Comprueba fecha en el campo y al confirmar | Comprueba fecha y muestra motivos antes de confirmar |
| Documento | Valida por tipo y muestra mensaje; acepta entrada manual | Valida por tipo y muestra mensaje |
| Razón social | Exige texto antes de enviar | No aparece una comprobación equivalente en motivosPendientes; pendiente de evaluación |
| Líneas, unidad, cantidad y descuentos | validarItems y liquidación global | Las mismas funciones |
| Inventario | revisarGrilla antes de enviar | revisarGrilla en motivosPendientes |
| Crédito | validarCronograma antes de enviar | validarCronograma y problemaDeCronograma |
| Origen, motivo y saldo de nota | No aplica a factura/boleta | problemasDeNota y consulta de saldo para notas de crédito |
| Detracción | Se calcula por línea y aplica umbral | El modal comprueba su código de cabecera para no notas |
| Serie | Serie fija según tipo | Longitud de serie y reglas de nota |

Las reglas del servidor continúan siendo decisivas; esta tabla solo compara comprobaciones de presentación. Las diferencias que no aplican al formulario de factura o dependen de otros procesos no se alteraron.

## Bandeja y datos de demostración

`InvoiceList` obtiene las páginas mediante una única consulta `invoicesApi.getInvoices`, aplica `porApartado` y `aplicarFiltros` para construir `visibles` y usa ese mismo arreglo en `InvoiceTable` y `calcularResumenFiscal`. La prueba `invoiceReconciliacionVista` suma las filas aceptadas del rango y compara la tarjeta. El 5 nov en esta sesión, el despliegue mostró ocho filas con el conjunto B001-0003/0004 y bruto aceptado S/ 5,942.48; no se reprodujo la discrepancia con las filas de la auditoría. No hay evidencia suficiente para atribuir su origen a caché o al seed.

El `package.json` del backend declara `seed` como comando independiente y `start:prod` ejecuta `node dist/main`; el orquestador de seeds inspeccionado llama a auth, customs y accounting. Esto no demuestra qué comandos externos configura el proveedor al arrancar ni qué base atendió cada respuesta: no se concluye que haya o no resiembra en el despliegue.

## Líneas reales del comprobante para notas

El listado que alimenta `InvoiceList` se adapta con `aComprobanteDemo` y deja `items: []`; el selector de notas solo recibe ese listado. `GET /invoices/:id` usa `SELECT_DETALLE` con `payload_ubl` internamente, pero `aDetalle` expone condiciones de pago, CDR e historial y no entrega las líneas del payload en su DTO. Para precargarlas hace falta un contrato de detalle de líneas verificadas (descripción, cantidad, unidad, valor, afectación y tributos), recuperar ese detalle al elegir origen y mapearlo sin inventar datos ausentes. No se implementó ni se alteraron datos históricos.

## Nota histórica FC01-00000009 y saldo

La nota aparece en el acreditado global de la bandeja por su importe y estado, pero `ControlSaldoNotas` y `saldoDevolvible` buscan notas por `referenced_invoice_id`; si es NULL no entra en esas consultas. La relación exacta de la nota histórica requiere evidencia del documento guardado; no debe inferirse por cliente. Opciones pendientes de decisión de Jhordy: (1) incluir la referencia fiscal persistida por número, solo para referencias inequívocas y con marca explícita, por empresa y evitando contar dos veces; riesgo de formatos históricos ambiguos o un vínculo textual incorrecto; (2) corregir el ID histórico tras verificar el documento fuente y con autorización expresa, auditoría y respaldo; riesgo de alterar evidencia y necesidad de control de datos. No se modificó la guarda ni se actualizaron registros.

## Restos fuera de alcance

No se implementaron moneda extranjera ni un visor nuevo de representación impresa. La deuda del validador XSL no se ha modificado. Las pruebas de pantalla y cálculo no equivalen a validación oficial completa del XML firmado; no se emitieron comprobantes para probar.
