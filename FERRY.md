# FERRY — Parte 8B-ter P2: mínimo de cantidades de NC total

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front main: `59cbbb48fba579b10917dcf151151f637fcfad54`.
Base back main: `68575577abed679326f2bb116c15151bb12a0044`.
Back asociado: `fix/m1-8b-ter-cantidades-totales` (P1 y P2).
Ferry: `ferry/m1-8b-ter-cantidades-totales`, un commit P2.
Sin push directo al repositorio front.

## Aplicación

Desplegar primero el back que añade `motivos_totales` al saldo.
Copiar SOLO los diez archivos de la tabla a sus rutas exactas del front.
No copiar el resto del árbol back ni FERRY.md. No hay borrados,
paquetes, cambios del selector ni migraciones.

| Operación | Ruta exacta front | SHA-256 |
|---|---|---|
| Reemplazar | `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `34c64a4dc1493561d6db90b337fb67f1605c5554cada7ea76bd06d5de4a051cd` |
| Reemplazar | `src/modules/invoices/components/InvoiceEmitModal.tsx` | `133db734fe2d923271f3211c2af6d0fbfa0e43eaa9a81b6c8049415635b362f1` |
| Reemplazar | `src/modules/invoices/lib/invoiceNoteQuantities.ts` | `80edc032329d41ddaff63271b2a6dd1abbac5db60fbf5f8a8665a433a89ddbe5` |
| Reemplazar | `src/modules/invoices/services/invoicesApi.ts` | `9fe68f4f97951654279a284136584331848a96505a40866f663a8615a1b110bc` |
| Reemplazar | `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | `659099192992c4900c4ffa2ba5487a0f50c6e4026958f284ada94b5f15f50e7a` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotaSaldo.test.tsx` | `46a844cc45ecff4e3db95462a3635e258a774002db729eb7a6753a8ba3d0418f` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotasErrorVisible.test.tsx` | `81aa8aa5e0cddd6d74c68778bd915f288694d0acaf38a4fd80e488c9e1305ee5` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | `9bd24ef2249cb931185d8cac84977f2c0a67084e403a7463650dcfe186a97cff` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotasPrecargaCapada.test.tsx` | `53882efa7fd3d8efa64b8d9168ccb502674afb37f0e1eb9046d28e3d52c17fb6` |
| Reemplazar | `test/unit/modules/invoices/invoiceNoteQuantities.test.tsx` | `c4a7b7578d323478ef61cf36d4e951012cd26820b544adc6918ec74f9e057ba8` |

## Contrato y alcance

El front recibe `motivos_totales` del saldo y valida el arreglo; no contiene una
lista propia de motivos totales. Metadatos ausentes o inválidos bloquean la NC
con un error de consulta visible, sin asumir una clasificación local.

Para los motivos recibidos como totales, `limitesNota` suma por SKU con Decimal,
exige todo el pool pendiente, detecta SKU omitidos y conserva el máximo existente.
Los errores llegan al resumen de pendientes, bloquean Emitir y se comprueban
con saldo fresco justo antes de publicar. La precarga y el prorrateo no cambian.

ND y motivos parciales mantienen su comportamiento. El motivo 02 usa el pool
pendiente para validar totalidad, pero no se cambia su clasificación física,
las reservas históricas, Kardex ni la reversión de costo. P3 queda fuera.
No se amplían las opciones visibles del selector.

## Verificación

Base front: 128 suites / 930 pruebas. Focal P2: 2 suites / 21 pruebas aprobadas.
Regresión de rechazo tardío: 1 suite / 4 pruebas aprobadas.
Build front y TypeScript back aprobados. Lint del alcance front conserva el error
set-state-in-effect y el aviso only-export-components de InvoiceEmitModal.tsx,
reproducidos en la base; sin diagnósticos nuevos ni supresiones.
P1/P2 completos: back **302 suites / 2769 pruebas y 12 snapshots**;
front **128 suites / 938 pruebas aprobadas**. La prueba antigua de media unidad
se adaptó a cantidades completas conservando el control de rechazo tardío y clave.
La adenda P3 se entrega después, en un commit back separado.

Sin migraciones, emisiones reales, PRs, merges ni despliegues durante el encargo.
