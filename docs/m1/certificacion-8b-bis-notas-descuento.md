# Parte 8B-bis — B1: candidato de certificación, NO certificado por SUNAT

Autorización de Emma/Jhordy, 11 de noviembre de 2026. Base back main: `da61217c24c3ffe2f31a1912779a51a2d0986b02` (290 suites / 2672 pruebas, 4 suites / 38 pruebas omitidas, 12 snapshots). Este cambio NO declara cerrado el error 3271.

## Alcance aislado

Único archivo de producción: `src/modules/invoices/xmlNodesHelper.ts`. Solo en CreditNote/DebitNote (07/08), el descuento de línea código 00 se representa con Price unitario NETO, calculado desde LineExtensionAmount con precisión unitaria de 10 decimales, y sin su AllowanceCharge. AlternativeConditionPrice sigue siendo el precio final con IGV. No se modifican impuestos, totales, payload persistido, adapter ni los datos históricos.

Descuento 01, facturas, boletas y notas sin descuento permanecen byte a byte iguales: ocho controles SHA-256 tomados del generador anterior lo verifican. Se adaptan dos aserciones antiguas que exigían allowance 00 en notas a la nueva representación; el control de orden/allowance de factura sigue vigente. No se actualiza ningún snapshot fiscal existente.

Caso equivalente al real: cantidad 1, precio bruto 41.30 y descuento 00 de 3.50; payload conserva valor unitario 35.00 y descuento 3.50. XML de NC/ND: Price 31.50, LineExtensionAmount 31.50, IGV 5.67, AlternativeConditionPrice 37.17, PayableAmount 37.17, sin allowance 00. Cantidad 3 comprueba precisión unitaria adicional y ausencia de mutaciones del payload.

## Evidencia y límite

Focales: **3 suites / 24 pruebas aprobadas**. Los cuatro casos de NC/ND se generan y firman con certificado ficticio y pasan el XSD + XSL del SFS local. Suite completa: **291 suites / 2684 pruebas aprobadas**, 4 suites / 38 pruebas omitidas, **12 snapshots intactos**. Build y lint del back aprobados. La primera corrida ajustó las dos aserciones previas; otra corrida con carga concurrente falló solo la latencia de TA-13. La corrida completa final, sin esa carga, pasó sin tocar umbrales.

El XML anterior TAMBIÉN pasa este set. La regla 3271 no está implementada en las hojas vendorizadas; la comprobación equivalente 4288 es una observación no bloqueante. Por ello, pasar localmente no acredita aceptación por SUNAT. Las observaciones del descuento 01 no se alteran ni se certifican aquí.

## Certificación y reversión

Emma hará, después del despliegue por su tren, UNA NC total sobre F001-00000069. Según la evidencia de producción aportada por Emma, su saldo sigue intacto porque FC01-00000015 fue rechazada. Codex no realiza esa emisión ni consulta/envío real alguno.

Si SUNAT beta acepta, Emma podrá declarar certificado este candidato. Si reaparece 3271, se revierte exclusivamente el commit B1 informado en el hilo y se replantea. El commit contiene este documento, el único archivo de producción y sus pruebas; F1/F2 no dependen de la representación XML candidata ni modifican esos archivos. Así se puede retirar B1 sin retirar el pulido del front.

Sin migraciones, cambios de otros módulos, PR, fusiones o despliegues por Codex.
