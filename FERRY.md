# FERRY — Corrección E del formulario de emisión M1

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base frontend: dev 991e9a6d118a4e39ff982495d89e5a23d469a6e6; el código M1 relevante coincide con producción main 14dfcd8bda2a3f03dec128121e39ab8ee695140b.
Base del transporte backend: 02627e833163b26d532461fe9ab6517a41bcb706.
Rama de transporte: ferry/m1-formulario-emision-e1-e3, exclusivamente en Jhordy-Salirrosas/Sistema-gestion-mype-sunat.

## Causa y alcance

La página /invoices/emision es el recorrido de Factura y Boleta. Su Liquidación y su acción Añadir eran independientes del modal; las pruebas anteriores de E1/E3 cubrían el modal. Los archivos del ferry anterior sí estaban presentes en el código de producción auditado.

E1: la Liquidación de la página reutiliza igvReferencialGratuito() y muestra IGV referencial como fila independiente. No se suma al importe a pagar ni al IGV cobrado.

## Commits fuente

- E1: 2ea2154485a2f9dfed58f34a9273e0b3353da704

## Aplicación

Copiar frontend/ a sus rutas equivalentes del frontend sobre la base indicada y verificar los hashes. No hay archivos eliminados ni cambios de dependencias. Ejecutar npm test y npm run build. Este transporte no crea PR, no realiza merges, despliegues ni emisiones.

## Validación

Línea base aceptada en producción 14dfcd8b: 164 archivos / 1264 pruebas verdes.
Prueba dirigida de E1 aprobada. La verificación completa del lote se registra en E3.

## Manifiesto SHA-256

| Archivo transportado | SHA-256 |
|---|---|
| frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx | 30c22026c2fd91a3168cfc600fc225821b7543af3feee6f72193a1f241257634 |
| frontend/test/unit/modules/invoices/invoicePageReferenceIgv.test.tsx | e184bc992a9b353fb49ddc74c7d5168555a6c4ce86e86158b517787638d48fc9 |
