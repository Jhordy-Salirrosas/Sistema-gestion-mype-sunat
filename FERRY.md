# FERRY — Formulario de emisión M1

Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base obligatoria del frontend: dev 5d238fc2f6df61eeb5fd2d3ccaf34693e6da4ca0.
Base del transporte: main f8156cce38134b0db7834a491289240b2046b745 del repo Jhordy-Salirrosas/Sistema-gestion-mype-sunat.
Rama de transporte: ferry/m1-formulario-emision.

## Alcance

E1: IGV gratuito gravado referencial en el resumen del modal; no integra el total a pagar.

E2: errores asociados a descripción, cantidad y valor, seguimiento de edición/revisión y foco al primer campo inválido al intentar emitir. Se conservan las guardas previas al POST y los avisos existentes.

E3: añadir enfoca el buscador del modal; SKU de catálogo de solo lectura. Se conserva la reutilización de la primera fila vacía y la edición de códigos manuales.

A2 ya está cubierto en la base y no se modifica. No se modifica código ni documentación del backend. No hay cambios de dependencias, migraciones ni archivos eliminados.

## Aplicación

Copiar los archivos bajo frontend/ a sus rutas equivalentes del frontend sobre la base indicada y verificar el SHA-256 de cada archivo final. Ejecutar npm test y npm run build. El transporte no realiza PR, merge, despliegue ni emisiones.

## Commits fuente por punto

- E1: 5b00ee86d73b8b313bcbb426e98c4532a46e9bfe
- E2: 42b8a5f73e7f104b11787c75de0238c1942be1cd
- E3: 78a417d97832598567553944d29c499dc60fc447

## Verificación

Línea base: 161 archivos / 1248 pruebas aprobadas.
Resultado completo: 164 archivos / 1264 pruebas aprobadas, sin fallos ni omisiones. Build correcto.
Cobertura local de código nuevo respecto de dev: 26/26 líneas y 57/57 ramas, 100%; calculada sobre el diff de producción contra la base indicada, con Vitest/V8.
Lint conserva un error react-hooks/set-state-in-effect y una advertencia react-refresh/only-export-components preexistentes en InvoiceEmitModal; ambos contrastados contra el archivo de la base. Sin problemas nuevos en los archivos modificados.

## Manifiesto SHA-256

| Archivo transportado | SHA-256 |
|---|---|
| frontend/src/modules/invoices/components/InvoiceEmitCampos.tsx | 434b9340dcfb59f187041230167900b5d5365eb4273c0ff960e2d12fa7eebb07 |
| frontend/src/modules/invoices/components/InvoiceEmitModal.tsx | b863bc96ea68fe48d1a556a38eba59073400bcde5a0a41c77911f9a1fa1d860c |
| frontend/src/modules/invoices/components/InvoiceEmitResumen.tsx | 76463eaae3c53b74ea06cc280771af3396e9ec23117b3aef52683c06109910cf |
| frontend/src/modules/invoices/components/InvoiceItemsGrid.tsx | 519570a19ce19651e67ee133312f3d643c6b145b8400af286d9434f411a7d3d5 |
| frontend/src/modules/invoices/lib/invoiceIgvReferencial.ts | 492cec058ff9a514fd8bc67c6bc2b574c1adab62ad85884fe5ea221a6b460183 |
| frontend/src/modules/invoices/lib/invoiceItems.ts | a63041b8895e16fca9b628bcb61b69c738f10de006a9f4defb850505a3354137 |
| frontend/src/modules/invoices/lib/invoiceLineFields.ts | 103b8406ec2c6acdac6c45be2bccafe4dbe860ec4df3497cca0db615ea8475bf |
| frontend/test/unit/modules/invoices/invoiceAddFocus.test.tsx | a6b1495584fbed3b61db7370fe5e312e221159a9e77792e69daa430f653bdd82 |
| frontend/test/unit/modules/invoices/invoiceCazaForm.test.tsx | 0f82d1da3e29799d40c8a20b3da5cccf29db882505870d9a720e32abfbc375c8 |
| frontend/test/unit/modules/invoices/invoiceFormValidation.test.tsx | dfbc078d72239500c8c0924f5080496487efc7e88ba0e160cb55b629970c8c3c |
| frontend/test/unit/modules/invoices/invoiceIgvReferencial.test.tsx | 0411d6064f1a63d359a25487d931c79459b5cae581f5ddbab0bea6e797ea5f3b |
| frontend/test/unit/modules/invoices/invoiceItemsLayout.test.tsx | 6f84e95c8bb1b90d1b5ef7fa733eceee49175786fab06fb5412bb837db0878a6 |
| frontend/test/unit/modules/invoices/invoiceLineFields.test.tsx | 8bf6952a64d755a95a4cd6efb30239fe6419d6ada2222f739d07b6df045b5685 |
