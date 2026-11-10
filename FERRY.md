# Ferry M1 — recuperación local del puente de aceptadas

Copiar SOLO los cuatro archivos front del manifest a sus rutas exactas en el
repositorio front. Esta rama del back es transporte de archivos; no integrar su
árbol backend en el frontend.

- Base front dev: `27731aa76de8f23d3de7ee05f35ff3833de3e905`.
- Commit front local probado: `a205cfbddee78ef5a24e16f35b2ace20b2144f24`. Sin push directo al repo front.
- Dependencia back: `41befcbdb37cea4f9e430b75a4e577740918d4ba`, rama `fix/m1-reproceso-puente`, base dev `23981b1da5f3bb7889a36e25ff1de5ef707848e9`.
- Endpoint ADMIN: POST `/api/v1/invoices/:id/reprocesar-puente` (el cliente usa `/invoices/:id/reprocesar-puente` con el prefijo existente). Solo ACEPTADO/OBSERVADO y empresa del token; sin cola de envío, consulta SUNAT ni reemisión.
- Solo detalle: acción «Reprocesar puente», estado de espera, resultado completo / ya estaba completo / sigue pendiente y errores, con asiento de venta/costo e importe cuando corresponde. Oculta para otros roles/estados. `retry-cdr` no cambia.
- Respuesta: completo, yaCompleto, asientoId/asientoOmitido, asientoCostoId/costoVenta, kardex, contadores y errores. El servicio compartido conserva las claves y la semántica por fases existentes.
- Front base 101 archivos / 797 pruebas; final **102 archivos / 811 pruebas**, cero fallos. Build y lint de los cuatro archivos modificados aprobados.
- Back base 263 suites / 2433 pruebas; final **264 suites / 2445 pruebas**, cero fallos. 4 suites / 38 pruebas omitidas y 12 snapshots fiscales intactos. Build/lint aprobados. Cobertura local nueva 95,62% líneas, 85,95% combinado LCOV + condiciones, sin cambiar gates.
- Validación del caso F001-64 simulada con motor FIFO real: venta existente, ALM-02, una unidad, costo 15.00; después, no-op sin nuevo movimiento, asiento, saldo o consumo. Falta de capa: pendiente recuperable.
- La F001-00000064 NO queda como exhibit. Tras el despliegue del equipo, Emma ejecutará la recuperación sobre su ID real y comprobará el movimiento y costo de S/15, conservando la venta 001-202611-039. Esta entrega no ejecuta la operación productiva ni afirma que ya ocurrió.
- Documentación: docs/m1/auditoria-solucion.md del commit back. Sin migraciones nuevas, modificaciones a otros módulos, emisiones, llamadas reales a SUNAT, PR, fusiones ni despliegues.

## Manifest front — cuatro archivos idénticos al clon probado

- `src/modules/invoices/components/InvoiceBridgeReprocess.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `test/unit/modules/invoices/invoiceReprocesoPuente.test.tsx`
