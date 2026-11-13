# FERRY — Consolidado normativa M1 · A5

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base del frontend: dev 98963cd781e2eab269497763d832898efcdcd8ac.
Commit local validado del frontend: 608a3fac324d60f5bfcb0005e4c6caa97a69004e.
Base del transporte backend: e4c8464b19657c14d213af328c6433df78512b31.
Rama de transporte: ferry/m1-consolidado-normativa, publicada exclusivamente en Jhordy-Salirrosas/Sistema-gestion-mype-sunat.
Backend complementario: fix/m1-consolidado-normativa en 5e7e83c4decbbb6f11d2e36e890ec6fdfed0a5ee.

## Alcance

Solo A5: «+ Añadir ítem» del modal y su atajo reutilizan la primera fila cuando no tiene código ni descripción. Conservan su clave y valores, sin crear otra fila. Si la primera ya tiene contenido, se añade una nueva sin sobrescribir lo editado. No se cambia la adición desde el catálogo ni la precarga de documentos origen. No se incorporan Monitor real ni los demás puntos del Formulario de emisión.

## Aplicación

Copiar los cuatro archivos de frontend/ a sus rutas equivalentes sobre la base indicada y comprobar sus SHA-256. No hay archivos eliminados ni cambios de dependencias. Ejecutar npm test y npm run build en el clon del frontend. Este lote no realiza despliegues, emisiones, migraciones, PR ni merges.

## Verificación

Frontend: base 158 archivos / 1235 pruebas; final 159 archivos / 1241 pruebas, todo verde. Build correcto. Código nuevo local 4/4 líneas y 5/5 ramas, 100%. La prueba previa de teclado se adapta a la reutilización de fila, conservando el reconocimiento del atajo por code y verificando la adición cuando la primera fila ya tiene descripción.

Lint: se conserva un error preexistente react-hooks/set-state-in-effect en InvoiceEmitModal (efecto que limpia el error de emisión), y un aviso only-export-components. Ambos se reprodujeron sobre el archivo de la base 98963cd7. No se suprimen reglas ni se cambia ese comportamiento por A5.

Backend complementario: base 338 suites / 3298 pruebas; final 344 suites / 3363 pruebas aprobadas, con las mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Código nuevo 72/72 líneas y 105/105 ramas, 100%. Las cinco correcciones tienen commits separados. Sección «Consolidado normativa» en docs/m1/auditoria-solucion.md.

## Manifiesto SHA-256

Rutas relativas al frontend; cada archivo transportado está bajo frontend/.

| Archivo final | SHA-256 |
|---|---|
| src/modules/invoices/components/InvoiceEmitModal.tsx | b4d126bd24d519124e2139fe95fbc7c42437165edef5a7a2979564cbf7609c10 |
| src/modules/invoices/lib/invoiceEmptyRow.ts | b45b73987d5e4fed4239f45b7eae2c920aeb23c258631907d46357338e780b16 |
| test/unit/modules/invoices/invoiceEmptyRow.test.tsx | 6e8ed3b980081ce617c47e71b72dff6ad7f1151e74d719c7681fb1755a764f5a |
| test/unit/modules/invoices/invoicePageKeyboard.test.tsx | cab141b4408338bd76bcf018f8707513b4cefa4e0c98781b7251d3671856b27e |
