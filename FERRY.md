# FERRY — Parte 7, decisión de reenvío (7J)

Destino: CarlosSoles/Fronted-sistema-mype-sunat.
Base front dev: `c20a63978b75711127a9b19310f56180a535220f` (merge #188).
Commit del clon front verificado: `3fad351` (no se publica directamente).
Base back dev: `7ac5cbbc250b4800af8840af5ab98be407a40f71` (merge #277).
Back asociado: `fix/m1-puente-guardas` — `000eecce936fdc487ba4ded54a60d6345a4ea1a2`, catorce commits funcionales A–N.

## Aplicación

Reemplazar únicamente los dos archivos siguientes en las rutas exactas del front.
No copiar el resto del árbol back ni este FERRY.md al front. No incluye borrados,
configuración, migraciones o acciones de emisión/consulta SUNAT.

| Operación en front | Ruta exacta | SHA-256 |
|---|---|---|
| Reemplazar | `src/modules/invoices/components/InvoiceForcedResend.tsx` | `c6a45d2099043e6a662a0f0e66b9568bc3dadf22e8fa3adea26c2a2bba9ae603` |
| Reemplazar | `test/unit/modules/invoices/invoiceCierreForzado.test.tsx` | `658f934f00b6dae3f8f02c62ff288485776715913e90cbe2992bdcf99e1268b7` |

## Contrato y comportamiento

El POST /invoices/:id/forzar-reenvio incluye decisionId estable durante el mismo
intento. El back devuelve AUTORIZACION_CONSUMIDA o REQUIERE_NUEVA_DECISION sin
publicar una segunda vez. La acción «Preparar una nueva decisión explícita»
renueva identidad, vacía motivo y confirmación y referencia renovarAutorizacionId.
El operador debe volver a escribir y confirmar. ADMIN y las guardas fiscales
siguen vigentes; no hay cambio en el flujo automático de conciliación.

Integrar coordinadamente con el back: el POST exige decisionId. No desplegar
este ferry ni el back de manera unilateral desde esta entrega.

## Verificación

- Baseline front: 123 suites / 885 pruebas aprobadas, cero fallos.
- Final front: 123 suites / 886 pruebas aprobadas, cero fallos.
- Focal 7J: 1 suite / 2 pruebas aprobadas.
- Build aprobado.
- ESLint de ambos archivos modificados: sin errores ni avisos.
- Lint global: 129 errores / 31 avisos, exactamente los mismos en la base dev
  aislada y en el clon final; pertenecen a archivos sin cambios de esta entrega.
- Ningún envío, emisión o llamada real a SUNAT. Sin PR, merge ni despliegue.

Los hashes cubren los bytes de los archivos de transporte, no este manifiesto.
El SHA-256 del propio FERRY.md se informa por separado en el hilo.
