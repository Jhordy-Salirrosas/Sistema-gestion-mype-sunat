# Semana Cueva — paquete 2: roles y permisos en el front

## Fase 0 actualizada: bases autorizadas

- Repo de entrega: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Base back: `feat/roles-permisos`, **`d5b0bab91921549e15409773f8eff9a5d17039f6`**. Rama de entrega `feat/roles-permisos-front`, sin merges ni cambios de implementación del back.
- Repo front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base front nueva autorizada: **`4abdfc0657c3817bb123a452c25ca79ff64e7a3c`**, merge del PR #317. Sustituye expresamente a `44cad5f` tras la resolución de fase 0.
- El checkout aislado se actualizó a ese SHA y permaneció limpio al medir la línea base, antes de cambiar código.

## Estado confirmado de los componentes

`useRolePermissions.ts` contiene una matriz escrita en código (con aliases ACCOUNTANT/OPERATOR). `RolePermissionsPage.tsx` existe y edita permisos por módulos con ADMIN bloqueado; `modulePermissionsApi.ts` contiene el cliente GET/PUT y `/me` de módulos. `UserWarehousesPage.tsx` lista usuarios y edita rol, estado activo y almacenes. `useInvoiceWritePermission.ts` en M1 todavía deriva canEmitInvoices/isReadOnly de la matriz escrita en código. Estos componentes sí existen en la nueva base; la diferencia que detenía el encargo queda resuelta.

## Línea base, antes de construir

Suite completa de **`4abdfc0`** con `npm test -- --maxWorkers=2` (Vitest/jsdom):

| Resultado | Archivos | Pruebas |
| --- | ---: | ---: |
| Aprobados | 192 | 1460 |
| Fallidos | 2 | 2 |
| Omitidos | 0 | 0 |
| Total detectado | 194 | 1462 |

Se reproducen exactamente los dos fallos ya medidos en `44cad5f`:

1. `invoiceBagsRegistered.test.tsx`: «modal entrega dos bolsas con el producto registrado y no inventa SKU».
2. `invoiceFormValidation.test.tsx`: «modal admite cantidad legítima de tres decimales».

Ambos fixtures usan `2026-11-12`; el día observado en America/Lima es `2026-11-16`, fuera del límite de tres días de factura. El modal bloquea antes del POST y las dos expectativas de llamada a la API fallan. La repetición dirigida sobre la base anterior pasó 13 pruebas y reprodujo esas dos. La suite completa nueva conserva los mismos resultados. Conforme a la instrucción del usuario, **no se corrigen ni ocultan esos fallos, no se cambia su fecha ni la validación**. El cierre comparará los nombres exactos: mismos dos o menos, ningún fallo nuevo.

## Contratos del paquete 1

El back base contiene GET `/auth/action-permissions/me`, GET/PUT `/auth/action-permissions` y POST `/auth/users` bajo `/api/v1`. Las acciones son INVOICE_EDIT_ISSUE_DATE, INVOICE_FORCE_RESEND, INVOICE_RESOLVE_DLQ e INVOICE_REPROCESS_BRIDGE; cada respuesta efectiva usa role/actionCode/allowed. La administración y el alta requieren ADMIN. El alta recibe name/email/password/role y devuelve id/companyId/email/fullName/role/isActive, sin hash. El login usa correo único global.

## Implementación por parte

Pendiente tras registrar esta línea base. Se entregará un commit por P1, P2, P3 y P4 y este commit de fase 0. El ferry reemplazará el inventario heredado por los archivos de este paquete sobre `4abdfc0`, con FERRY.md y SHA256SUMS. Sin PRs ni merges.
