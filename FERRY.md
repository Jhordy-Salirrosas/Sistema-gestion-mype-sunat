# FERRY — Corrección E del formulario de emisión M1

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base frontend: dev 991e9a6d118a4e39ff982495d89e5a23d469a6e6; el código M1 relevante coincide con producción main 14dfcd8bda2a3f03dec128121e39ab8ee695140b.
Base del transporte backend: 02627e833163b26d532461fe9ab6517a41bcb706.
Rama de transporte: ferry/m1-formulario-emision-e1-e3, exclusivamente en Jhordy-Salirrosas/Sistema-gestion-mype-sunat.

## Causa y alcance

La página /invoices/emision es el recorrido de Factura y Boleta. Su Liquidación y su acción Añadir eran independientes del modal; las pruebas anteriores de E1/E3 cubrían el modal. Los archivos del ferry anterior sí estaban presentes en el código de producción auditado.

E1: la Liquidación de la página reutiliza igvReferencialGratuito() y muestra IGV referencial como fila independiente. No se suma al importe a pagar ni al IGV cobrado.

E3: página y modal comparten la acción de añadir y el criterio de primera fila vacía disponible. Se conserva su clave y no se acumulan filas vacías al repetir el botón o el atajo. La elección de producto rellena esa fila. Ambos botones de la página y Alt+L dirigen el foco al buscador real del formulario. Si no está disponible, se muestra y enfoca el estado de carga, error o catálogo vacío.

En la página, Código es de solo lectura desde la fila vacía; se completa seleccionando un producto. El modal conserva su bloqueo de códigos seleccionados y su funcionamiento de selección y adición. A2, las reglas tributarias, el payload y el backend no se modifican.

## Commits fuente

- E1: 2ea2154485a2f9dfed58f34a9273e0b3353da704
- E3: 3410370e6c2beab6e4250422c754546b678246ee

## Aplicación

Copiar frontend/ a sus rutas equivalentes del frontend sobre la base indicada y verificar los hashes. No hay archivos eliminados ni cambios de dependencias. Ejecutar npm test y npm run build. Este transporte no crea PR, no realiza merges, despliegues ni emisiones.

## Validación

Línea base aceptada en producción 14dfcd8b: 164 archivos / 1264 pruebas verdes.
Resultado completo sobre dev 991e9a6: 166 archivos / 1276 pruebas aprobadas, sin fallos ni omisiones. Build verde. Código nuevo local: 17/17 líneas ejecutables y 23/23 ramas (100%), medidos sobre el diff contra la base.

Las pruebas montan la ruta /invoices/emision para Factura y Boleta con la respuesta API balances, el normalizador y el buscador reales y userEvent: escritura tras Añadir, ambos botones, Alt+L, pulsaciones repetidas, SKU vacío de solo lectura, selección con y sin fila vacía y estados de carga/error/vacío. El modal se verifica con los mismos datos. E1 comprueba base gratuita 100.00, referencia IGV 18.00, IGV cobrado 0.00 y total 0.00, y excluye gratuitas no gravadas.

Las pruebas previas de clientes se delimitan al mensaje de búsqueda del maestro, permitiendo coexistir con el estado del catálogo. La prueba de teclado conserva detección por code y ausencia de doble ejecución, con la nueva reutilización aprobada.

Lint mantiene dos errores react-hooks/set-state-in-effect y una advertencia react-refresh/only-export-components preexistentes en la página/modal, reproducidos sobre los archivos de la base. Sin incidencias nuevas.

## Manifiesto SHA-256

| Archivo transportado | SHA-256 |
|---|---|
| frontend/src/modules/invoices/components/InvoiceEmitModal.tsx | d7e2dac3fdc3973266be038d569810adbe1b0b2f8a64cebbde22800a05cda22d |
| frontend/src/modules/invoices/components/InvoiceItemsGrid.tsx | 5ddf52c070a3a140287f9b74274a4bbe7871310e7a9bc04932a4fe6948973e7f |
| frontend/src/modules/invoices/lib/invoiceEmptyRow.ts | f04339c58ee822fbc2e4fb3038da2c9cd97133f2b7804e1685116d71f0915573 |
| frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx | d912523b0e3a32dca80f81b078d16358290cde813a9fdd41fdc294f5a7ec022a |
| frontend/test/unit/modules/invoices/invoiceClienteBusqueda.test.tsx | ce9746d4ebf4a2761525e0cd6501c23deacdb59c3aac822cf2ba896049f7432b |
| frontend/test/unit/modules/invoices/invoicePageAddSearch.test.tsx | 05e3e0c125f082a664ea9a281c001147e80abee5a48a56a1ef576ce067df11f3 |
| frontend/test/unit/modules/invoices/invoicePageKeyboard.test.tsx | eeedae74a0b02b76e2563c443dbfdc532b8649151d70b1f81284498fc292af33 |
| frontend/test/unit/modules/invoices/invoicePageReferenceIgv.test.tsx | e184bc992a9b353fb49ddc74c7d5168555a6c4ce86e86158b517787638d48fc9 |
