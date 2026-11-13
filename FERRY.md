# FERRY — Formulario de emisión M1

Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base obligatoria del frontend: dev 5d238fc2f6df61eeb5fd2d3ccaf34693e6da4ca0.
Base del transporte: main f8156cce38134b0db7834a491289240b2046b745 del repo Jhordy-Salirrosas/Sistema-gestion-mype-sunat.
Rama de transporte: ferry/m1-formulario-emision.

## Alcance

E1: IGV gratuito gravado referencial en el resumen del modal; no integra el total a pagar.

A2 ya está cubierto en la base y no se modifica. No se modifica código ni documentación del backend. No hay cambios de dependencias, migraciones ni archivos eliminados.

## Aplicación

Copiar los archivos bajo frontend/ a sus rutas equivalentes del frontend sobre la base indicada y verificar el SHA-256 de cada archivo final. Ejecutar npm test y npm run build. El transporte no realiza PR, merge, despliegue ni emisiones.

## Commits fuente por punto

- E1: 5b00ee86d73b8b313bcbb426e98c4532a46e9bfe

## Verificación

Línea base: 161 archivos / 1248 pruebas aprobadas.
Pruebas dirigidas aprobadas para el punto; la verificación completa del lote se registra en el commit E3.

## Manifiesto SHA-256

| Archivo transportado | SHA-256 |
|---|---|
| frontend/src/modules/invoices/components/InvoiceEmitResumen.tsx | 76463eaae3c53b74ea06cc280771af3396e9ec23117b3aef52683c06109910cf |
| frontend/src/modules/invoices/lib/invoiceIgvReferencial.ts | 492cec058ff9a514fd8bc67c6bc2b574c1adab62ad85884fe5ea221a6b460183 |
| frontend/test/unit/modules/invoices/invoiceIgvReferencial.test.tsx | 0411d6064f1a63d359a25487d931c79459b5cae581f5ddbab0bea6e797ea5f3b |
