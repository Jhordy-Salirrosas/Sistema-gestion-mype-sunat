# Ferry — Semana Cueva, roles y permisos del front

Rama `feat/roles-permisos-front`, desde back `d5b0bab91921549e15409773f8eff9a5d17039f6`. Base front autorizada `4abdfc0657c3817bb123a452c25ca79ff64e7a3c` de `CarlosSoles/Fronted-sistema-mype-sunat`.

Este inventario sustituye al espejo heredado: las versiones previas ya viven en el main front indicado. Copiar `frontend/.` sobre la raíz del checkout front, conservando los demás archivos. No aplicar al front las eliminaciones del espejo que aparecen en el diff del back. Antes de copiar, verificar `sha256sum -c SHA256SUMS`; cada ruta del manifiesto es relativa al back. El manifiesto incluye todo `frontend/` y este FERRY.md, no su propio hash.

## API consumida y lugares

- P1: `actionPermissionsApi.ts` consume GET `/auth/action-permissions/me`, GET/PUT `/auth/action-permissions`; `useActionPermissions.ts` expone las acciones efectivas, sin defaults de permisos locales, con caché por usuario/rol/empresa y bloqueo durante carga/error.
- P2: `useInvoiceWritePermission.ts` consume GET `/auth/module-permissions/me`. Página/modal de emisión consultan la acción de fecha; reenvío forzado, DLQ y puente consumen sus acciones además de escritura M1 y sus condiciones operativas. No cambia la regla fiscal ni los dos fixtures de fecha preexistentes.
- El ferry incluye la configuración de pruebas y sus respuestas API simuladas; no son defaults de producción.

La fase 0 y los conteos están en `docs/m1/roles-permisos-front.md`. Base: 194 archivos, 1460 pruebas aprobadas y dos fallos de fecha preexistentes. Se conservan sin corregir sus fixtures ni su validación; el cierre no admite fallos nuevos. No cambia código del back. Sin PRs ni merges.
