# FERRY — Reenvío masivo del Monitor M1

Repositorio destino del código: CarlosSoles/Fronted-sistema-mype-sunat.
Base frontend: dev `da8f3874b03e46a8f0f1d29c0e69d9dcdcc21431`.
Rama de transporte en el repositorio backend: `ferry/m1-reenvio-masivo`.
Base del transporte: `19de0ebe6372d3949c51f7830c8e64aaef7d6d8f`.
Commit fuente: `82c981370d37bf07d68f32b38da9e2ce44926734`.
Dependencia backend: rama `fix/m1-reenvio-masivo`, commit `4ba00d3cf14337f2dbf468b570ce289a79e2a93c`.

## Alcance y aplicación

Copiar los cuatro archivos de frontend/ a sus rutas equivalentes del frontend sobre la base indicada. No hay eliminaciones ni cambios de dependencias. Verificar los hashes y ejecutar npm test y npm run build. El ferry no modifica código backend.

La página real InvoiceMonitorPage incorpora Reenviar encolados, solo para ADMIN mediante useRolePermissions. GET /invoices/retry-batch obtiene conteos y detalles de vista previa sin publicar. La confirmación explícita llama POST de la misma ruta y muestra el resultado reevaluado, con las omisiones por incertidumbre, rechazo definitivo, bloqueo local, trabajos ya en cola, otro lote en curso, estado y resultados no confirmados. La UI no deduce los conteos del historial o de las filas visibles. Se conserva el resultado tras refrescar el Monitor; no se invoca el reenvío forzado.

La doble activación inmediata queda bloqueada en el componente y el backend protege solicitudes concurrentes mediante exclusión mutua por empresa. La API no cambia la firma ni el envío del worker; conserva la compuerta individual y sus consultas conservadoras para marcadores históricos nulos.

## Verificación

Base: 166 archivos / 1276 pruebas aprobadas. Final: 167 archivos / 1284 pruebas aprobadas, sin fallos ni omisiones. Build correcto. Cobertura nueva local contra la base: 30/30 líneas ejecutables y 17/17 ramas instrumentadas (100%). Las ocho pruebas nuevas cubren el Monitor real, contrato snake_case de la API sin historial, roles, previa/confirmación/cancelación, cero elegibles, errores, doble clic y preservación del resultado al actualizar. Se repite el spec afectado tras retirar un import sin uso.

Lint de los cuatro archivos cambiados sin errores; quedan dos advertencias preexistentes de exportaciones en InvoiceMonitorPage. El lint global de la base contiene 139 errores y 28 advertencias, fuera de este cambio.

Documentación de causa y diseño: sección Reenvío masivo del Monitor en docs/m1/auditoria-solucion.md del commit backend dependiente.

No se crean PR, merges, despliegues ni emisiones reales. La revisión y certificación corresponden al tren posterior.

## Manifiesto SHA-256

| Archivo transportado | SHA-256 |
|---|---|
| frontend/src/modules/invoices/components/InvoiceBatchRetry.tsx | ced1cdd87cd84c6cf0bdf8e3c91f167a4d8508927502bb7793588aa4eae06c36 |
| frontend/src/modules/invoices/pages/InvoiceMonitorPage.tsx | c8f85a8dfe2580f6a16bde522ce8548730e4dec05cc96fef2d0a5ddab73cbc4a |
| frontend/src/modules/invoices/services/invoiceBatchRetryApi.ts | ad82c4247faf936ef6f662a95d5d69f050826b32e9d4e4acce1afd1f2df591a3 |
| frontend/test/unit/modules/invoices/invoiceBatchRetry.test.tsx | bbb32dcc043b1b9e0734c0574e544de12f7d395464bde9657a89039a4ffa8f1d |
