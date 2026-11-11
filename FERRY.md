# FERRY — Parte 8B: guardas de notas, B3

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front dev: `316e681ec89c72f5de0ac4e6bac71a8ee992d1a3`.
Commit del clon front: `221b8a8ae8b8cc57ee5e283bd0bbc0d6bb552f0e` (sin push directo).
Base back dev: `b4b8febd497db0a1b3572c44d2fc9acec216f680`.
Back asociado: `fix/m1-guardas-notas`, `da4af268122862682ba012653eca6a0579773fff`.

## Aplicación

Copiar SOLO los nueve archivos siguientes en las rutas exactas del FRONT. No copiar el resto del árbol del back ni este FERRY.md al front. Sin borrados, paquetes, cambios de esquema o migraciones.

El front requiere el back 8B: GET /invoices/:id/saldo añade cantidades_pendientes: [{codigo, original, pendiente}]. Integrar coordinadamente y disponer primero del contrato del back. Una respuesta vieja/incompleta se bloquea con motivo visible, nunca se convierte en cantidades inventadas. B1/B2 son cambios exclusivos del back; este commit transporta B3.

| Operación | Ruta exacta del front | SHA-256 |
|---|---|---|
| Reemplazar | `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `618d87da5d123915b80263a23b6531a715f463345113effdf341fc1c0805311d` |
| Reemplazar | `src/modules/invoices/components/InvoiceEmitModal.tsx` | `6f29b7df1853ff70e5020525f0659e01722cec2ac07888e161bc0f5429771753` |
| Reemplazar | `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `f5c9a733cc40c6404f556671240f14a4efeacc469b34f5587437a50982406bd8` |
| Añadir | `src/modules/invoices/lib/invoiceNoteQuantities.ts` | `aa4072b4ca14ff1ff498d5b755578f1cedab3bbcd4a026fe51af7b75cb038741` |
| Reemplazar | `src/modules/invoices/services/invoicesApi.ts` | `5ff14fcb2823bb31a4000377ef0a7b86129193c006872fc4286efca1b9bd4b87` |
| Reemplazar | `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | `8b92ef2e853070e43e6440c57ee0b2870acdf9312a7424502d149cbfb1f18171` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotaSaldo.test.tsx` | `de1ecc243c7c36af320ea729dcbd73d09b1df4c8c7879958ee2fa399487bd614` |
| Reemplazar | `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | `31635ae6983bafc375ec023530d711542edb1a6833e473845f6d9841977f8b39` |
| Añadir | `test/unit/modules/invoices/invoiceNoteQuantities.test.tsx` | `d5261ef99e3f60af0473d57c43ce6b1e5cead7bebb982f5c470f481be7bf3267` |

## Comportamiento

- NC 01/06/07 usa unidades pendientes por SKU; motivos sin devolución física (p. ej. 13) conservan el límite original del servidor. ND y ventas mantienen sus campos existentes.
- Cada máximo descuenta las cantidades solicitadas en las demás filas del mismo SKU, con aritmética decimal. No se inventa identidad de línea del origen.
- Atributo max, aria-invalid, error junto al campo y bloqueo del envío; no se recortan silenciosamente las cantidades.
- Antes de publicar se consulta el saldo de nuevo: un consumo concurrente detectado impide la publicación. El guard transaccional del back decide ante una carrera posterior.
- No se amplían los motivos del selector, ni se cambian precios, redondeos o reglas fiscales.

## Verificación

- Front base: 125 suites / 908 pruebas aprobadas; final: **126 suites / 913 pruebas aprobadas**, cero fallos.
- Focales B3 front: 4 suites / 22 pruebas aprobadas (incluidas regresiones de precarga, saldo y formularios).
- Build front aprobado.
- ESLint del alcance: 1 error y 2 avisos PREVIOS en InvoiceEmitModal, mismos que la base 316e681 comprobada por stdin: set-state-in-effect, exhaustive-deps y only-export-components. Sin incidencias nuevas ni desactivación de reglas; los otros archivos modificados no añaden incidencias. No se declara saneado el lint global del proyecto.
- Back por punto: B1 288/2645; B2 289/2666; B3 final **290/2672**. En cada corrida, 4 suites / 38 pruebas omitidas y 12 snapshots aprobados, sin actualizaciones.
- Build y lint global del back aprobados.
- Sin emisiones, llamadas a SUNAT, migraciones, PR, fusiones o despliegues.

Los hashes cubren los bytes de los archivos transportados. El SHA-256 del propio manifiesto se informa por separado.
