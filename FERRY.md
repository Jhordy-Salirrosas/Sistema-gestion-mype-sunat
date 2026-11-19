# Ferry — UX completa del M1 Facturación

Rama única: `ferry/m1-ux-completa`.

## Bases y fase 0

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`, main verificado **`1ea9689280e1f28823c2d4600c6d73dd44ad44fe`**. Incluye PR #357 y el commit posterior de SIRE; no se modifica ese módulo.
- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, base main **`145bf7818dc87b730c9033dcded6783d18014744`**.
- Suite base, ejecutada antes de editar: **217 archivos, 1593 pruebas aprobadas, 0 fallidas, 0 omitidas**.
- ESLint base en `src/modules/invoices` y `test/unit/modules/invoices`: **18 errores y 11 advertencias** preexistentes. El cierre compara las incidencias por archivo, regla y mensaje, no solo el conteo global.
- Revisión interna de componentes, contratos, campos y flujos: el inventario siguiente registra la clasificación previa a construir y el veredicto final. No se solicitó una aprobación adicional.

## Inventario de los 40 puntos

Las rutas abreviadas de componentes, páginas, hooks y lib corresponden a `src/modules/invoices/`, salvo las rutas completas indicadas.

| Punto | Fase 0 | Veredicto final | Archivos y evidencia |
| --- | --- | --- | --- |
| 1 | Parcial | Implementado | `components/InvoiceStatusBadge.tsx`. Insignias fiscales con texto, icono decorativo y colores de contraste; no dependen solo del color. |
| 2 | Parcial | Implementado | `lib/invoiceBandejaState.ts; lib/invoiceResumenes.ts`. ETIQUETAS_BANDEJA es el vocabulario fiscal compartido. La salud operativa usa otro catálogo explícito; los códigos y mensajes literales de auditoría no se reinterpretan. |
| 3 | Parcial | Implementado | `lib/invoiceMapper.ts:estadoBackend; lib/invoiceApiMapper.ts:OBSERVADO`. El campo real estadoBackend conserva OBSERVADO (invoiceMapper/aComprobanteDemo); se presenta como Aceptada con observación, distinguible de Aceptada. RECHAZADO solo se acredita como SUNAT con resultadoPresentacion.origen=SUNAT; preparación local y origen desconocido conservan categoría propia. Motivo y guía junto a las acciones. |
| 4 | Ya existe | Ya existe, conservado | `components/InvoiceTableRow.tsx`. La insignia es un span; Ver y la fila son acciones separadas. No se convierte el estado en enlace. |
| 5 | Parcial | Implementado | `pages/InvoicesDashboardPage.tsx; pages/InvoiceMonitorPage.tsx`. InvoicePriorityNotice selecciona un aviso principal por prioridad. Los demás se consultan en Otros avisos; resultados de subprocesos se mantienen en línea. |
| 6 | Parcial | Implementado | `components/InvoiceTable.tsx; components/InvoiceTableRow.tsx`. Serie–número destacado en primer lugar; después fecha, cliente y total. Se mantienen los demás importes y campos. |
| 7 | Parcial | Ya existe, completado | `components/InvoiceTable.tsx`. Importes alineados a la derecha; caption semántico y descripción visible de la tabla. |
| 8 | Parcial | Implementado | `components/InvoiceTable.tsx`. Encabezado sticky en el contenedor con scroll; zebra, bordes y hover mediante CSS exclusivo del M1. |
| 9 | Parcial | Implementado | `lib/useInvoiceFiltros.ts; components/InvoiceFiltersBar.tsx`. Filtros accesibles sin desplegar un panel, chips individuales y Limpiar todo. Persistencia en URL, respaldo de sesión por empresa y conteos de pestañas tomados de la lista ya cargada. Sin consultas adicionales para conteos. |
| 10 | Parcial | Implementado | `InvoiceList.tsx; services/invoicesApi.ts:getInvoices`. Páginas de 25 sobre todas las páginas que la capa existente ya carga. Filtrar u ordenar vuelve a la primera; sin paginador para una página. No se añade scroll infinito. |
| 11 | Parcial | Implementado | `components/InvoiceTableRow.tsx`. Una acción visible Ver; XML, CDR, PDF y reintento existentes se agrupan en Más acciones, con texto y nombres accesibles. |
| 12 | Estacionado | Estacionado en la parte de selección | `services/invoiceBatchRetryApi.ts`. invoiceBatchRetryApi.previa/ejecutar actúan sobre todos los elegibles y NO aceptan IDs. Se conserva el flujo masivo real; no se añaden casillas que aparenten limitarlo. Vincular selección a ese lote exige otro contrato, fuera de alcance. |
| 13 | Implementar | Implementado | `components/InvoiceCdrModal.tsx`. InvoiceCdrModal ofrece variante lateral role=region, sin Dialog, backdrop ni captura modal del foco. Bandeja y agregados reutilizan datos, refresco, descargas y acciones; Escape y Cerrar permiten volver. Al abrir desde acciones se muestra de nuevo el inicio de la tabla para comparar la identificación, y al cerrar se recuperan desplazamiento y foco. |
| 14 | Parcial | Implementado en la ventanilla | `components/CustomerLookupField.tsx; components/InvoiceItemsGrid.tsx`. Cabecera/cliente, grilla y cuotas presentan errores al salir y los ocultan durante la edición; descuento global y detracción enlazan su error. Se conservan las normalizaciones de entrada existentes (cantidades y bolsas enteras), que no se sustituyen por reglas nuevas. Los flujos de notas conservan sus validaciones y campos. |
| 15 | Implementar | Implementado | `pages/InvoiceEmissionPage.tsx`. Resumen local sobre las validaciones existentes con foco, icono y enlaces a campos o grupos. Misma cadena de mensaje en feedback y resumen para esos campos; no se usa el banner de envío para estas validaciones. |
| 16 | Parcial | Implementado | `lib/invoiceEmitValidation.ts; lib/invoiceEmissionValidation.ts`. Mensajes existentes específicos de documento/fecha/cantidad, con icono y corrección o guía. No se alteran los predicados fiscales ni el traductor del payload. |
| 17 | Parcial | Implementado en la ventanilla | `pages/InvoiceEmissionPage.tsx; components/useInvoiceKeyboard.tsx`. Revisar y emitir presenta cliente, ítems, tributos, total y medio de pago; Cambiar devuelve a cada sección. Confirmar vuelve a ejecutar el mismo emisor y el mismo borradorAPayloadEmision. El modal de notas conserva su recorrido y su revisión por teclado existente. |
| 18 | Parcial | Ya existe, completado | `pages/InvoiceEmissionPage.tsx; components/InvoiceWriteButton.tsx`. Panel de liquidación fijo y resumen móvil de la ventanilla conservados. Deshabilitación por permisos o envío en curso con explicación visible; los errores de campos se pueden consultar al intentar revisar, sin imponer una regla nueva de bloqueo. |
| 19 | Implementar | Implementado en la ventanilla | `pages/InvoiceEmissionPage.tsx`. Autoguardado local diferido y vaciado al salir, marca HH:MM Lima, recuperación explícita y descarte sin confirmación. Clave por empresa/usuario, cliente registrado releído del maestro, reglas comerciales existentes reaplicadas; éxito elimina el borrador y error conserva datos. Nunca se almacena una credencial ni se agregan campos al payload. |
| 20 | Parcial | Ya existe, conservado | `components/CustomerLookupField.tsx; components/InvoiceEmitCampos.tsx; components/InvoiceEmitModal.tsx`. CustomerLookupField rellena identidad/dirección y condición; PartnerFormDialog registra sin salir. Las notas heredan referencia, adquirente y líneas del origen; se conservan los importes/cantidades y motivos que exigen las notas parciales, sin ocultar campos requeridos por el flujo vigente. |
| 21 | Parcial | Implementado | `pages/InvoicesDashboardPage.tsx`. Resumen ordenado en avisos prioritarios, periodo/indicadores y accesos. Sin bloque decorativo por encima de la acción. |
| 22 | Implementar | Implementado | `pages/InvoicesDashboardPage.tsx`. Todos los indicadores enlazan periodo y estado a la bandeja. La vista ampliada incluir_notas=1 tiene chip explícito y eliminable, para no perder el alcance de cifras que incluyen notas. Filtrado local, sin API nueva. |
| 23 | Ya existe | Ya existe, conservado | `components/InvoiceSendAgeAlert.tsx; lib/invoiceAlertas.ts`. InvoiceSendAgeAlert muestra fechaEmision, fechaLimite y diasRestantes reales de alertas.antiguedad; no se inventa un vencimiento a partir de un tipo de documento. |
| 24 | Parcial | Ya existe, completado | `hooks/useInvoiceRefresh.ts; hooks/useInvoiceDetailRefresh.ts; InvoiceList.tsx`. Estado persistente en cada fila y aria-live sin mover foco. Las lecturas frescas del detalle se reflejan también en la fila mediante onActualizado/reflejarDetalle, sin otra consulta. Se mantienen useInvoiceRefresh, useInvoiceDetailRefresh y su sondeo tras INVOICE_QUEUED; no se agregan websockets ni un mecanismo de sincronización nuevo. |
| 25 | Parcial | Implementado en las cargas de página adaptadas | `InvoiceList.tsx; pages/InvoiceMonitorPage.tsx`. InvoiceWait no muestra indicador antes de 2 s; luego muestra spinner/esqueleto del área y tras 10 s texto de espera. No hay porcentaje ni barra ficticios: las consultas no exponen avance. Las operaciones existentes conservan sus bloqueos y mensajes de ejecución. |
| 26 | Parcial | Implementado | `components/InvoiceCdrModal.tsx; pages/InvoiceEmissionPage.tsx`. Detalle con encabezado textual de resultado fiscal acreditado. Alta de emisión sigue diciendo registrado, no aceptado sin CDR. Validación local en resumen/feedback, errores de envío conservan resultado y valores. |
| 27 | Parcial | Implementado con el límite del punto 12 | `pages/InvoiceMonitorPage.tsx; components/InvoiceBatchRetry.tsx`. Comprobante identificado, guía conservadora, motivo literal, código en detalle técnico y reintento individual existente. ERRORES_M1 traduce 2108, 2957, 3319 y 3267 ya documentados en el front; desconocido conserva guía genérica sin inventar significado. Lote real global, sin selección ficticia. |
| 28 | Parcial | Implementado | `InvoiceList.tsx; pages/InvoiceDetractionsPage.tsx; pages/SalesReportPage.tsx`. Bandeja distingue primera emisión, filtros sin coincidencias, carga y fallo; ofrece Emitir el primero o Limpiar filtros. Detracciones distingue error de vacío y ofrece bandeja; reportes muestran carga y estado vacío existente. Clientes mantiene el vacío del maestro en su variante M1. |
| 29 | Parcial | Implementado | `components/EnviarBajaPanel.tsx`. Confirmación de baja con números, importes y cliente por lectura existente getInvoiceById. Si esa lectura falla se indica cliente no disponible, sin inventarlo. Consecuencia irreversible explícita; Anular factura/Anular comprobantes y Cancelar, foco inicial en Cancelar. |
| 30 | Parcial | Ya existe, completado | `components/useInvoiceDuplicate.tsx; components/InvoiceEmitModal.tsx`. Sin confirmaciones añadidas para filtros, descargas, descarte o quitar ítems. Quitar un ítem en la ventanilla ofrece Deshacer. Se conserva la decisión de fusionar o separar productos repetidos, que elige una operación comercial y no es una confirmación genérica. |
| 31 | Ya existe | Ya existe, completado | `components/EnviarBajaPanel.tsx; components/InvoiceAggregateMonitor.tsx`. La baja se registra cuando SUNAT la acepta; se explica que no se revierte y se orienta a nota de crédito o nuevo comprobante si corresponde. No hay promesa de deshacer una baja. |
| 32 | Parcial | Implementado en la variante M1 | `componentes y páginas M1 (variante CSS local)`. Tokens locales para texto gris, campos y foco; colores opacos de insignias. Se verifica contraste de estos pares, sin tocar tema ni componentes globales. No se declara una certificación WCAG exhaustiva de componentes compartidos no modificados. |
| 33 | Parcial | Implementado en el alcance adaptado | `pages/InvoiceEmissionPage.tsx; componentes M1`. Anillo visible, márgenes de scroll, foco del resumen y retorno desde revisión; panel de detalle no bloquea la navegación. Componentes compartidos fuera de la variante M1 conservan su implementación. |
| 34 | Parcial | Implementado en la variante M1 | `components/InvoiceTableRow.tsx; componentes M1`. Objetivos de al menos 24px; acciones con relleno y paginador con botones. Los controles compartidos fuera del contenedor mantienen su diseño original. |
| 35 | Parcial | Implementado | `components/InvoiceStatusBadge.tsx; componentes M1`. Acciones de fila con texto; iconos de estado/decoración aria-hidden y nombres accesibles en controles, cierre y filtros. |
| 36 | Parcial | Implementado en textos adaptados | `páginas y componentes M1`. Títulos de páginas y estados en sentence case; eliminadas las referencias Verde/Azul/Rojo y el aviso visible con endpoints o tenant. |
| 37 | Parcial | Implementado en textos nuevos | `páginas y componentes M1`. Constancia de Recepción (CDR) en Monitor y accesos; revisión desarrolla Impuesto General a las Ventas (IGV) e Impuesto al Consumo de las Bolsas de Plástico (ICBPER). Mensajes literales del servidor se preservan. |
| 38 | Parcial | Implementado | `lib/invoiceResultPresentation.ts; pages/InvoiceMonitorPage.tsx`. InvoiceIssueGuidance separa consecuencia, siguiente paso, motivo literal y detalle técnico; no se atribuye una causa específica a un código desconocido. |
| 39 | Parcial | Parcial: descarga estacionada | `pages/InvoiceDetractionsPage.tsx; components/InvoiceConfigChecklist.tsx; src/modules/customs/pages/PartnersPage.tsx (compartido)`. Detracciones reutiliza estado textual/icono de depósito, tabla y foco M1. Configuración conserva los datos reales de SOL/certificado/series, con estado e iconos; Resumen prioriza el vencimiento existente. Clientes/proveedores usa InvoiceClientsPage, variante M1 del maestro, sin modificarlo. La constancia de depósito es un número; no existe descarga en el servicio, por lo que ese archivo requiere back/contrato y no se simula. |
| 40 | Estacionado | Estacionado por diseño | `Fuera del módulo interno`. Portal externo para clientes, conservación mínima anual, autenticación y publicación documental requieren nueva funcionalidad, back y seguridad; fuera de esta rama UX interna. |

## Límites de datos y contratos

No se modifican servicios HTTP, tipos de API, payload de emisión, reglas fiscales,
catálogos de negocio, permisos ni el back. `invoiceFormIssues` reúne predicados
que la página ya ejecutaba. El submit conserva su validación original y utiliza
el mismo `borradorAPayloadEmision` y `invoicesApi.emitirComprobante`.
`noValidate` evita que el navegador intercepte el formulario antes del resumen;
las restricciones existentes se siguen ejecutando en el emisor, además del servidor.
La revisión no transmite datos hasta confirmar.

La única lectura agregada para enriquecer una confirmación es la ya disponible
`getInvoiceById` por documento seleccionado. Retomar un cliente registrado usa
`masterDataApi.getPartner` existente para no confiar en una condición comercial
guardada localmente. No hay endpoints ni contratos nuevos.

La expansión `incluir_notas` y los grupos de estado del indicador son filtros
locales de presentación sobre la lista completa que el front ya carga.
No se modifican importes ni el estado fiscal de un registro.

Los datos del borrador se guardan en `m1:emision:v1:<empresa>:<usuario>` solo en
este navegador. Se ofrece recuperación explícita; no se trata como documento
emitido ni como fuente de permisos. No hay sincronización entre dispositivos.
Las entradas existentes del modal de notas mantienen sus reglas y sus campos;
los puntos de revisión/autoguardado descritos se aplican a la ventanilla.

La variante `InvoiceClientsPage` envuelve el maestro existente solo en la ruta
M1. El cambio de `src/routes/appRoutes.tsx` se limita a esa importación y ese
binding. No se modifica `src/modules/customs`, otros módulos, Sidebar ni auth.
Los cambios a `test/fixtures/invoiceEmissionProduct.ts` solo añaden el paso de
confirmación explícita de revisión a las pruebas; no alteran datos fiscales.

El estado OBSERVADO no se infiere de un mensaje ni se convierte en ACEPTADO:
se lee de `estadoBackend`. Los mensajes técnicos y de auditoría se conservan
como evidencia literal. Los textos del catálogo operativo no son estados CDR.

## Verificación final

- Suite completa final: **220 archivos, 1625 pruebas aprobadas, 0 fallidas y 0 omitidas**.
- Delta respecto de la base: **+3 archivos de pruebas y +32 casos**. Se mantienen las aserciones de reglas, importes, permisos e idempotencia; las adaptaciones existentes cubren vocabulario, selectores y confirmación de revisión.
- Nuevas coberturas: diccionario/insignia, validación al salir y resumen con foco/enlaces, revisión sin POST anticipado y payload idéntico, guardado/recuperación/descarte y error sin pérdida, URL/chips/paginación, panel no modal con retorno de foco y sincronización de estado, confirmación de baja, traducción conservadora de errores y vacíos con salida.
- Build de producción `npm run build`: **aprobado** (TypeScript y Vite).
- ESLint final: **18 errores y 11 advertencias**, todos preexistentes; **0 errores nuevos** por comparación de archivo/regla/mensaje con la base. No se cambian reglas ni exclusiones de lint.
- Navegador Chromium local, pantallas reales con respuestas simuladas: Resumen, Facturas/Boletas, Emitir, Notas, Detracciones, Anulación/Resúmenes, Monitor, Configuración, Clientes y reporte de ventas, en **1440/1280/1024/768/360px: 50 combinaciones**, sin desbordamiento del documento ni errores de ejecución. Detalle lateral verificado sin rol dialog ni bloqueo modal de la bandeja.
- Se ajusta la altura del panel de la ventanilla al espacio real; los filtros de la bandeja preceden a sus indicadores y permanecen disponibles al desplazarse.
- Contraste medido en estilos computados: insignias muestreadas **8.13:1** como mínimo, texto secundario **7.73:1**, borde de campo **4.83:1** y foco **6.70:1** contra el fondo claro. Esta comprobación del alcance adaptado no equivale a una auditoría WCAG integral.
- `git diff --check`: aprobado; **80/80 archivos** del transporte coinciden byte a byte con el front probado.

Durante la adaptación, las primeras corridas detectaron expectativas del vocabulario y del recorrido anteriores. Se corrigieron las pruebas de presentación sin cambiar sus expectativas fiscales. La última corrida completa se ejecutó sobre el árbol de entrega estable, sin omisiones ni filtros de suites.

No se aplican cambios de back ni de producción. Quedan estacionados la selección individual del lote global, la descarga de archivos de constancia no expuestos y el portal externo, en los puntos 12, 39 y 40.

## Delta real contra el main del front

**80 archivos: 47 de interfaz y 33 de pruebas/fixtures.** A = nuevo; M = modificado.

| Estado | Archivo del front |
| --- | --- |
| M | `src/modules/invoices/InvoiceList.tsx` |
| M | `src/modules/invoices/components/CreditInstallmentsEditor.tsx` |
| M | `src/modules/invoices/components/CustomerLookupField.tsx` |
| M | `src/modules/invoices/components/EnviarBajaPanel.tsx` |
| M | `src/modules/invoices/components/InvoiceAggregateMonitor.tsx` |
| M | `src/modules/invoices/components/InvoiceBatchRetry.tsx` |
| M | `src/modules/invoices/components/InvoiceCdrModal.tsx` |
| M | `src/modules/invoices/components/InvoiceConfigChecklist.tsx` |
| M | `src/modules/invoices/components/InvoiceDemoNotice.tsx` |
| M | `src/modules/invoices/components/InvoiceDescuentoGlobal.tsx` |
| M | `src/modules/invoices/components/InvoiceEmitModal.tsx` |
| M | `src/modules/invoices/components/InvoiceFiltersBar.tsx` |
| A | `src/modules/invoices/components/InvoiceFormFeedback.tsx` |
| A | `src/modules/invoices/components/InvoiceIssueGuidance.tsx` |
| M | `src/modules/invoices/components/InvoiceItemsGrid.tsx` |
| M | `src/modules/invoices/components/InvoiceKpiCards.tsx` |
| A | `src/modules/invoices/components/InvoicePriorityNotice.tsx` |
| A | `src/modules/invoices/components/InvoiceReview.tsx` |
| M | `src/modules/invoices/components/InvoiceRvieSection.tsx` |
| M | `src/modules/invoices/components/InvoiceSendAgeAlert.tsx` |
| M | `src/modules/invoices/components/InvoiceStatusBadge.tsx` |
| M | `src/modules/invoices/components/InvoiceSunatConsulta.tsx` |
| M | `src/modules/invoices/components/InvoiceTable.tsx` |
| M | `src/modules/invoices/components/InvoiceTableRow.tsx` |
| A | `src/modules/invoices/components/InvoiceUxPage.tsx` |
| A | `src/modules/invoices/components/InvoiceWait.tsx` |
| M | `src/modules/invoices/components/MedioPagoDetraccionSelect.tsx` |
| A | `src/modules/invoices/components/invoiceUx.css` |
| A | `src/modules/invoices/hooks/useInvoiceBlur.ts` |
| A | `src/modules/invoices/hooks/useInvoiceLocalDraft.ts` |
| M | `src/modules/invoices/lib/invoiceAlertas.ts` |
| M | `src/modules/invoices/lib/invoiceBandejaState.ts` |
| A | `src/modules/invoices/lib/invoiceErrorGuidance.ts` |
| M | `src/modules/invoices/lib/invoiceExportPdf.ts` |
| M | `src/modules/invoices/lib/invoiceFilters.ts` |
| A | `src/modules/invoices/lib/invoiceFormIssues.ts` |
| M | `src/modules/invoices/lib/invoiceResumenes.ts` |
| M | `src/modules/invoices/lib/useInvoiceFiltros.ts` |
| M | `src/modules/invoices/pages/InvoiceBajasPage.tsx` |
| A | `src/modules/invoices/pages/InvoiceClientsPage.tsx` |
| M | `src/modules/invoices/pages/InvoiceDetractionsPage.tsx` |
| M | `src/modules/invoices/pages/InvoiceEmissionPage.tsx` |
| M | `src/modules/invoices/pages/InvoiceMonitorPage.tsx` |
| M | `src/modules/invoices/pages/InvoiceSettingsPage.tsx` |
| M | `src/modules/invoices/pages/InvoicesDashboardPage.tsx` |
| M | `src/modules/invoices/pages/SalesReportPage.tsx` |
| M | `src/routes/appRoutes.tsx` |
| M | `test/fixtures/invoiceEmissionProduct.ts` |
| M | `test/unit/modules/invoices/InvoiceStatusBadge.test.tsx` |
| M | `test/unit/modules/invoices/bandeja-ui.test.tsx` |
| M | `test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx` |
| M | `test/unit/modules/invoices/invoice8cBridgePending.test.tsx` |
| M | `test/unit/modules/invoices/invoiceAggregateMembers.test.tsx` |
| M | `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` |
| M | `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx` |
| M | `test/unit/modules/invoices/invoiceBatchRetry.test.tsx` |
| M | `test/unit/modules/invoices/invoiceCazaBandeja.test.tsx` |
| M | `test/unit/modules/invoices/invoiceCazaForm.test.tsx` |
| M | `test/unit/modules/invoices/invoiceCierre6cCarga.test.tsx` |
| M | `test/unit/modules/invoices/invoiceCierreDuplicados.test.tsx` |
| M | `test/unit/modules/invoices/invoiceConsultaSunat.test.tsx` |
| M | `test/unit/modules/invoices/invoiceDetallesBandeja.test.tsx` |
| M | `test/unit/modules/invoices/invoiceFacturaDocumento.test.tsx` |
| M | `test/unit/modules/invoices/invoiceFormValidation.test.tsx` |
| M | `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` |
| M | `test/unit/modules/invoices/invoiceMonitorReal.test.tsx` |
| M | `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` |
| M | `test/unit/modules/invoices/invoiceNotasSeparadas.test.tsx` |
| M | `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` |
| M | `test/unit/modules/invoices/invoicePulidoClienteEmision.test.tsx` |
| M | `test/unit/modules/invoices/invoicePulidoDashboard.test.tsx` |
| M | `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx` |
| M | `test/unit/modules/invoices/invoiceReconciliacionVista.test.tsx` |
| M | `test/unit/modules/invoices/invoiceResumenes.test.ts` |
| M | `test/unit/modules/invoices/invoiceTa63Selector.test.tsx` |
| M | `test/unit/modules/invoices/invoiceVentanilla.test.tsx` |
| A | `test/unit/modules/invoices/m1UxDraft.test.tsx` |
| A | `test/unit/modules/invoices/m1UxFilters.test.tsx` |
| A | `test/unit/modules/invoices/m1UxStates.test.tsx` |
| M | `test/unit/modules/invoices/rucForms.test.tsx` |

## Aplicación y reversión

Copiar únicamente los archivos de `frontend/` sobre las mismas rutas del front
contra la base indicada, revisando cambios posteriores de main. Este es un
ferry, no una actualización de código del back. El inventario sustituye los
restos de ferries anteriores de la rama de transporte; sus eliminaciones NO
son una instrucción para borrar esos archivos en el repositorio del front.

Todo el paquete pertenece a una sola rama y debe revisarse como un solo PR
cuando el equipo decida crearlo. Antes de integrar, cerrar ese PR descarta la
entrega. Después de integrar, revertir su merge revierte el paquete completo.
En esta comisión no se crean PRs, no se realizan merges ni despliegues y no se
accede a producción ni a bases compartidas.

`SHA256SUMS` incluye este manifiesto y cada archivo transportado en `frontend/`.
