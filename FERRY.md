# Ferry M1 — Cantidades solo enteras

## Base y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`, base `main` exacta `9dcf7ff7bd6b24031e43b23e71b94d40170fedb1`.
- Commit local de implementación (sin push al front): `49b01070cb723f8df018400afe5bfd809599b257`.
- Rama front sugerida: `fix/m1-cantidad-solo-enteros`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-cantidad-solo-enteros`.
- Base del transporte: `07ea5ff9d87b68512209f5da8a2ed862edd94268`.

Se utiliza una base de transporte del back sin artefactos anteriores bajo `frontend/`, para entregar exclusivamente los siete archivos de este cambio. La base de aplicación del front es la indicada arriba.

## Cambio

La cantidad de cada línea usa siempre `InvoiceIntegerInput`, tanto en venta como en nota y para cualquier unidad (incluidas KGM y ZZ). Se retira la rama decimal de la grilla. Se conserva el máximo de unidades de origen, los identificadores, la accesibilidad, las validaciones y el recálculo del descuento heredado.

El control utiliza el spinner nativo con paso 1. El punto y la coma separan una fracción que se descarta: `1.001 → 1`, `2.5 → 2`, `2,5 → 2`. Al teclear se impide concatenar los dígitos fraccionarios a la parte entera; al pegar un decimal se conserva su parte entera. Los enteros normales y sus ceros iniciales siguen normalizándose sin redondeo. Signos negativos y exponentes se rechazan como antes. Al salir, un vacío se normaliza al mínimo del control (1 en Cantidad; 0 en Bolsas).

Una cantidad decimal precargada o recuperada de un borrador se trunca también en el estado de edición, para que el valor visible y el valor del formulario coincidan. Esto no modifica documentos fiscales guardados ni los datos fuente del origen. Las bibliotecas de lectura/validación histórica permanecen intactas; la grilla aplica la edición entera independientemente de esa precisión histórica.

Bolsas sigue utilizando el mismo control y admite cero y enteros. No se modifica V.U., `InvoiceMoneyInput`, los campos de dinero, las bibliotecas de cálculo, servicios, payloads, backend ni otros módulos.

## Verificaciones

- Suite completa: **231 archivos / 1692 pruebas**, verde sobre el commit final (`npm test`).
- Build de producción: OK (`npm run build`, TypeScript y Vite).
- Lint de los siete archivos tocados: sin hallazgos.
- Pruebas dirigidas: cantidad decimal escrita/pegada, punto/coma, spinner paso 1, entero normal, ceros, negativos, exponentes, vacío al salir, decimal precargado, NIU/KGM/ZZ en venta y nota, límite del origen, descuento heredado y Bolsas. Se ajustan las expectativas que exigían el antiguo editor decimal y las que esperaban el antiguo tipo textual del control.
- Chromium con la grilla real y producto CLV-2 (KGM), en venta y nota: teclado `1.001 → 1`, `2.5 → 2`, `2,5 → 2`, entero 7 sin cambios, flecha arriba `7 → 8`, abajo `8 → 7`, pegado con coma y salida del campo con valor/modelo 2. Evidencia local: `cantidad-chromium-verificacion.json`. No se realizan emisiones ni llamadas de escritura a servicios reales.

## Aplicación

Copiar los siete archivos de `frontend/` a sus rutas relativas a la raíz del front sobre la base indicada. No hay archivos que eliminar. `FERRY.md` y `SHA256SUMS` son metadatos de transporte y no se copian a producción. Verificar desde la raíz del transporte con `sha256sum -c SHA256SUMS`.

## Archivos (+/− respecto de la base front)

| Ruta | Diff |
| --- | ---: |
| `src/modules/invoices/components/InvoiceIntegerInput.tsx` | +47 / −13 |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | +6 / −19 |
| `test/unit/modules/invoices/invoiceEmitBagsInput.test.tsx` | +9 / −5 |
| `test/unit/modules/invoices/invoiceEmitQuantity.test.tsx` | +5 / −22 |
| `test/unit/modules/invoices/invoiceFormValidation.test.tsx` | +2 / −2 |
| `test/unit/modules/invoices/invoiceIntegerInput.test.tsx` | +59 / −0 |
| `test/unit/modules/invoices/invoiceVentanilla.test.tsx` | +3 / −3 |
