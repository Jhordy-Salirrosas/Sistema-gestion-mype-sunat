# FERRY — Parte 8B-bis: F1 precarga y F2 errores visibles

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front main: `be2c1cde8b790e1b67b3dc1574a7b751f4b7a233` (incluye #195 y #196; #196 solo cambia Colecciones).
Clon front verificado: F1 `2384127c431ff6119ba414577c162b42d74f2d9a`; F2/final `b2a88ee078d1da06d039ea3a7218d87cf3018f50`. Sin push directo al repo front.
Base back main: `da61217c24c3ffe2f31a1912779a51a2d0986b02`.
Back asociado: `fix/m1-notas-descuento`, `6d852dfadc3a7bca06a5fb688a1471ee600aeb50`.

## Estado de certificación del back

**B1 NO ESTÁ CERTIFICADO POR SUNAT.** Commit aislado/revertible `bcbb33cdc12fd9cf849967f3f40ebcd8a697c367`: solo notas 07/08 y descuento 00, Price neto y sin su AllowanceCharge; payload, impuestos, totales, adapter, descuento 01, facturas y boletas intactos. El XML anterior también pasa el SFS local: este set no ejecuta 3271. Emma hará UNA NC total sobre F001-00000069 después de su despliegue. Si beta acepta, se cierra; si vuelve 3271, revertir exclusivamente B1 y replantear. F1/F2 no dependen de esa representación candidata. Codex no realiza la prueba real.

## Aplicación

Copiar SOLO los cinco archivos de la tabla a sus rutas exactas del FRONT. No copiar el resto del árbol del back ni FERRY.md al front. Sin borrados, cambios de paquetes, migraciones o archivos de otros módulos. Se utilizan Decimal y el extractor común ya presentes en la base. F1 requiere el contrato cantidades_pendientes de la Parte 8B, ya incluido en esta base.

Dos commits ferry: F1 `94b3186` y F2 (este commit), separados por subparte. B1 permanece exclusivamente en la rama back.

| Operación | Ruta exacta front | SHA-256 |
|---|---|---|
| Reemplazar | `src/modules/invoices/components/InvoiceEmitModal.tsx` | `d50264ce1883644a75d361a720117696e6a803731aa223784417bef6d5581806` |
| Reemplazar | `src/modules/invoices/lib/invoiceIdempotency.ts` | `b1f12445d8ea13b1d9b682bf39cb90418cd991924da0594d332c1337e4d8a6e4` |
| Reemplazar | `src/modules/invoices/lib/invoiceNoteQuantities.ts` | `8ba21dac047da92201c883a8d01f7df6190e1989f979d217f696662a697caa61` |
| Añadir | `test/unit/modules/invoices/invoiceNotasErrorVisible.test.tsx` | `4c314a59ed19efb04e7497667b310799f6de981442da8eb50c5e9c9fdd26e2b5` |
| Añadir | `test/unit/modules/invoices/invoiceNotasPrecargaCapada.test.tsx` | `d8aa0872a702bcf59fad88739633ac288b6e391af9656d23e53d50ec5cf9087c` |

## F1 — Contrato de precarga y prorrateo

- Esperar detalle y saldo antes de precargar NC. Consumir el pool por orden original: 2+3 con pendiente SKU 4 se precarga 2+2. Excluir filas agotadas; si no quedan, indicarlo sin crear una línea artificial.
- 01/06/07 usan pendiente; motivos sin devolución física conservan el pool original. ND conserva su precarga anterior.
- Regla de Emma: en una fila recortada, descuento e importe ICBPER se prorratean por cantidad nueva/original, Decimal HALF_UP a 2 decimales. No se alteran precios/valores unitarios. Una fila no recortada conserva su precisión. Si el descuento redondea a cero se omite, respetando la positividad del DTO. Se conservan las validaciones existentes de bolsas enteras y tarifa ICBPER.
- No sobrescribir ediciones del usuario cuando llega tarde el detalle o al refrescar el saldo. Cambiar origen/tipo inicia otra precarga protegida. El servidor sigue siendo la autoridad sobre unidades y dinero.

## F2 — Contrato de errores

El extractor común existente conserva response.data.detail/message. Solo 409 identificado como IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY muestra el texto de clave reutilizada. Otros 409 muestran su causa o un conflicto genérico; 400 muestra el motivo del back. Datos, clave de reintento y comportamiento offline permanecen intactos.

## Verificación

| Subparte | Suite completa |
|---|---|
| Base back | 290 suites / 2672 pruebas |
| B1 back final | 291 suites / 2684 pruebas |
| Base front | 126 suites / 913 pruebas |
| F1 front | 127 suites / 921 pruebas |
| F2 front final | 128 suites / 925 pruebas |

Back: 4 suites/38 pruebas omitidas; 12 snapshots intactos. B1 focales 3 suites/24 pruebas; ocho controles SHA-256 fijan bytes previos fuera del caso candidato. Build y lint back aprobados. Reversión del parche B1 comprobada en seco, sin ejecutarla.

F1 focales 4 suites/22 pruebas (spec nueva de ocho casos); F2 focales 2 suites/13 pruebas (spec nueva de cuatro casos). Builds front aprobados. Lint F2 limpio. F1 conserva 1 error y 1 aviso PREVIOS del modal (set-state-in-effect y only-export-components); elimina el aviso previo de dependencias. Sin incidencias nuevas, supresiones ni configuración alterada. No se declara saneado el lint global del front.

Sin emisiones reales, SUNAT real, migraciones, PR, merges o despliegues por Codex. Ramas de la Parte 8B ya mergeadas intactas.

Los hashes cubren los bytes de los cinco archivos. El SHA-256 del manifiesto se informa por separado.
