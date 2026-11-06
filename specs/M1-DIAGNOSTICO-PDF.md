# M1: diagnóstico del test intermitente de PDF

Fecha: 5 de noviembre de 2026 (hora de Lima). Rama de front fix/m1-detalles, sobre dev 4f060ff. El test está en el front, en `test/unit/modules/invoices/invoiceExports.test.ts`, dentro de `construirPdfBinarioSunat`; el backend no contiene ese test.

Se ejecutó 10 veces de manera consecutiva el archivo completo mediante `npx vitest run test/unit/modules/invoices/invoiceExports.test.ts`: 10/10 ejecuciones pasaron, 18/18 pruebas por ejecución (180 pruebas ejecutadas). Al inicio se ejecutaban simultáneamente las suites completas de backend y front y comprobaciones TypeScript; durante la corrida también se inició otra suite completa del front. Las pruebas usaron Vitest 5.0.5, jsdom y Windows. Cada ejecución fue un proceso nuevo. Los logs temporales de la sesión son `work/pdf-detalles-1.log` a `work/pdf-detalles-10.log` en el directorio de trabajo compartido.

El fallo intermitente no se reprodujo en estas condiciones. No es posible establecer su causa raíz a partir de estas corridas ni afirmar que quedó estabilizado; no se cambiaron ni debilitaron las aserciones del PDF. Si reaparece, conservar el mensaje, stack, duración, carga y orden de ejecución permitirá investigar antes de aplicar un ajuste específico.
