# Ferry — Bandeja de comprobantes y detalle modal

- Rama: `ferry/m1-bandeja-modal`.
- Front destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base obligatoria del front, sincronizada y verificada: **`6ea2c1f6ce72651c8e98dff5ad66ad13dd32f875`** (main, PR #364).
- Base del repositorio de transporte: `627e29f56e4f090d06b2349f58a63408773ffcf6`.

## Cambio

En Facturas y Boletas, la tabla termina en **Estado CDR**, sin columna Acciones,
botón Ver ni menú Más acciones. La columna y sus controles se omiten del DOM.
Cualquier celda de la fila abre el detalle existente en un modal centrado con
fondo atenuado. La fila conserva el acceso por teclado (Enter y Espacio).

Se reutiliza InvoiceCdrModal: número, cliente, estado, Reprocesar puente cuando
corresponde, pestañas Auditoría CDR y Visor XML UBL 2.1, descargas oficiales de
XML/PDF/CDR y Cerrar. Se conserva la pestaña inicial que ya abría la fila.
El reintento de CDR que estaba en la fila se traslada también al modal, con la
misma condición de transporte y el mismo InvoiceWriteButton/flujo existente.
No se pierde ninguna descarga ni acción de la fila.

El modal se cierra con Cerrar, Escape o clic en el fondo; se devuelve el foco a
la fila. El encabezado del diálogo queda correctamente asociado para lectores
de pantalla. La variante sin acciones solo se activa en la bandeja principal;
Notas y Bajas conservan su presentación y acciones previas.

No cambian filtros, ordenación, paginación, distintivos, consultas, servicios,
tipos de API, payloads ni reglas. No se modifica ningún archivo de back.
Las opciones añadidas a componentes son exclusivamente de presentación.

## Delta real contra la base del front

| Archivo | Cambio |
| --- | --- |
| `src/modules/invoices/InvoiceList.tsx` | Activa la variante sin acciones y el modal solo en Facturas y Boletas; conserva callbacks y retorno de foco. |
| `src/modules/invoices/components/InvoiceTable.tsx` | Variante optativa sin la última columna; ajusta el colspan del vacío. Orden y paginación permanecen iguales. |
| `src/modules/invoices/components/InvoiceTableRow.tsx` | Omite la celda de acciones en esa variante; clic de fila y teclado reutilizan la apertura existente. |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | Reutiliza la ventana emergente existente, corrige su asociación de título y admite el reintento trasladado de la fila. Variante lateral conservada para las otras pantallas. |
| `test/unit/modules/invoices/invoiceCazaBandeja.test.tsx` | Actualiza el recorrido de bandeja para abrir desde la fila y descargar dentro del modal. Mantiene las verificaciones de importes y actualización de estado. |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | Nuevo: ausencia de acciones, clic en distintas celdas, Enter, tres cierres, descargas, condición de reintento y regresión de Notas. |

## Verificaciones

- Suite completa del front: **223 archivos, 1645 pruebas aprobadas, 0 fallidas, 0 omitidas**.
- Doce casos nuevos específicos; pruebas existentes de bandeja adaptadas sin
  cambiar sus expectativas de importes ni de actualización del estado.
- Build de producción `npm run build`: **aprobado**, TypeScript y Vite.
- ESLint en los seis archivos: **0 errores**; conserva dos advertencias
  preexistentes de InvoiceList (exportación para Fast Refresh y dependencia
  setFiltros del callback existente).
- Navegador Chromium local con respuestas simuladas: **15 casos**, combinando
  1440/1280/1024/768/360px con Cerrar/Escape/fondo. Modal centrado, fondo atenuado,
  tabla de nueve columnas y sin desbordamiento ni errores de ejecución.
- Comprobadas las pestañas y las tres descargas por sus flujos existentes.
- Regresión de Notas: conserva Acciones y detalle lateral, sin modal nuevo.
- `git diff --check`: aprobado. Los seis archivos del ferry coinciden byte a
  byte con el árbol probado.
- Servicios, modelos de API, payloads, rutas, estilos y archivos del back:
  sin modificaciones.

## Aplicación

Copiar los **seis archivos** de `frontend/` a sus mismas rutas del repositorio
front, comparando con la base indicada si main incorpora cambios posteriores.
El inventario del ferry contiene únicamente este delta. Los archivos de
ferries anteriores retirados de la rama de transporte **no deben eliminarse
del repositorio del front**.

`SHA256SUMS` verifica este manifiesto y todos los archivos transportados.
Sin PRs, merges, despliegues ni acceso a datos de producción.
