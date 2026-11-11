# FERRY — Parte 8A: descuento y redondeo

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front dev: `315f50ccf2e9de73e5cef713d03121febf63d8d9`.
Clon front verificado: `f7d7ec5123da684dbe8a17c5acd1404ca6cf6a90` (sin publicación directa).
Base back dev: `4877dc1c6dac306c187be043e765612a81134a33`.
Back asociado: `fix/m1-descuento-redondeo`, `91b9408a6c75f846de6f17ad1edbd7f7e2d932e4`.

## Aplicación

Copiar exclusivamente los diez archivos de este manifiesto a sus rutas exactas del FRONT, sobre su base indicada. No aplicar este árbol como código del back ni copiar FERRY.md al front. No hay borrados. Los package.json/package-lock.json transportados son los del front: declarar decimal.js como dependencia de producción y ejecutar npm ci en la integración del front.

Dos commits de transporte: 8A-2 (paquete decimal, aritmética, contrato y prueba) y 8A-3 (campos de descuento y prueba). 8A-1 y 8A-4 son exclusivamente back.

| Operación | Ruta exacta front | SHA-256 |
|---|---|---|
| Reemplazar | `package-lock.json` | `ef6f2ae147093af5e18f231818e1eaf8e35f0d8b02fcdfde1c0ce2eeec996ecf` |
| Reemplazar | `package.json` | `0a15c4c479f22e26e2884c74ad3b06de181b1ca0a382eb792d3ca498e97c7f38` |
| Reemplazar | `src/modules/invoices/components/InvoiceDescuentoGlobal.tsx` | `c99ae4ac99553f4c0bb8d2f7887b319bf578cf359cc619ca7870fa95e1a09f36` |
| Reemplazar | `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `016e9b5bc08fc953a783a32a4fa155f6c06d1c2766f751cf03ffa213730c5712` |
| Reemplazar | `src/modules/invoices/lib/invoiceDescuentoGlobal.ts` | `c21239d8254d8e32233ca2b96c6614e365a5faa365d487498729ed8c2d7ab313` |
| Reemplazar | `src/modules/invoices/lib/invoiceItems.ts` | `82d8826f77c2785b620aa3c63f8cd0fee6eb3ed92d931deb1d39cd7d1b6d4569` |
| Reemplazar | `src/modules/invoices/lib/invoiceTaxes.ts` | `7d87169dc28a297bc3c5bb9890386bf1169db9c3a16c1866ef7b2ddda47b099d` |
| Añadir | `test/fixtures/m1/redondeo-paridad.json` | `e7ea1710ec754f0eece942f41b6e5ff082eb3678ecc3df189062620780dc4d8d` |
| Añadir | `test/unit/modules/invoices/m1DescuentoEntrada.test.tsx` | `1ef0ddf642dad95bc6ecb8e33a9ff0868e5eda2917fef89ed37aa2a904a8e7ec` |
| Añadir | `test/unit/modules/invoices/m1RedondeoParidad.test.ts` | `47c6653b197668619e319d0151c8aead698f2bf057c123335766a2f0aca513f9` |

## Contrato

- 8A-2: Decimal HALF_UP coherente con money.ts del back; se multiplica/divide antes de redondear. 7.1 × 1.15 = 8.17. No se redondea prematuramente el precio unitario persistido para calcular líneas exoneradas/inafectas. La guarda del back que coteja el precio del catálogo permanece intacta.
- El archivo redondeo-paridad.json es idéntico al del back: 17 casos comprobados por el adapter y el PayableAmount XML, y por calcularItem en el front. No incluye el defecto previo gratuita+ICBPER, documentado como pendiente en auditoria-solucion.md.
- 8A-3: borrador textual decimal mientras se escribe el descuento de línea o global, usando InvoiceMoneyInput; no cambia la matemática fiscal. Escritura secuencial 4.13, pegado, borrado, reescritura y formato al abandonar.
- SPOT: cuotas usan la detracción exacta; el depósito BN redondeado solo se usa en la presentación de pago directo. La fórmula con retención simultánea se conserva.

## Verificación

- Front base: 123 suites / 886 pruebas aprobadas.
- Front final: 125 suites / 908 pruebas aprobadas, cero fallos.
- Paridad focal: 1 suite / 18 pruebas aprobadas; entrada focal y regresiones: 3 suites / 14 pruebas aprobadas.
- Build aprobado. ESLint de los archivos TS/TSX modificados sin errores ni avisos; no se modifica ni se declara saneado el lint global ajeno.
- Back base 284/2604; final 287/2635, con 4 suites/38 pruebas omitidas y 12 snapshots intactos. Build y lint global aprobados. SFS offline con XML generado y firmado ficticiamente: descuento de línea, global y SPOT al crédito sin errores.
- Sin migraciones, emisiones, SUNAT real, PR, fusiones o despliegues.

Los hashes cubren los bytes de los archivos de transporte. El hash del propio FERRY.md se comunica por separado.
