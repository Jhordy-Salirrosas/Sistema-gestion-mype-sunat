# Ferry — Semana Cueva, paquete 3B: roles administrables

Rama de entrega back `feat/roles-administrables`, desde dev `d28ffc80591e3418b230b0163468d26aab22f298` de Jhordy-Salirrosas/Sistema-gestion-mype-sunat.

Front construido sobre main **`dcf7864b3bc5e705ffea08ae3884e9bc0523c328`**, CarlosSoles/Fronted-sistema-mype-sunat. El inventario frontend/ contiene únicamente el delta de este paquete; sustituye el espejo heredado del back, cuyos archivos previos ya viven en la base front indicada. **No aplicar al checkout front las eliminaciones del espejo del diff del back.** No hay borrados de archivos requeridos en el front.

## Aplicación y prerrequisitos

1. Verificar `sha256sum -c SHA256SUMS` desde la raíz del back. Las rutas del manifiesto son relativas a esa raíz; incluye todo frontend/ y este FERRY.md, no su propio hash.
2. Preparar un checkout front limpio del SHA indicado y copiar frontend/. sobre su raíz conservando el resto. No se copia ni se despliega código de backend desde esta carpeta. No requiere dependencias nuevas.
3. El front requiere las APIs nuevas del back 3B y el SQL aditivo antes de publicarse. Contra un back que solo tiene el paquete 1, la consulta de permisos falla y la UI cierra accesos; no hay fallback a la matriz local. El despliegue y el corte están fuera de esta entrega.
4. El alta/asignación propia permanece deshabilitada por el flag del servidor. La UI no dispone de un flag local para eludirlo; los endpoints también lo exigen. No se activa el esquema candidato ni se aplica conversión enum→texto.

## API consumida y lugares

- `rolesApi.ts`: GET /auth/roles, GET /auth/roles/config y GET /auth/permission-catalog; PATCH /auth/roles/:code envía únicamente name. POST /auth/roles solo se ofrece tras habilitación del servidor; hoy deshabilitado. RoleMaintainer permite renombrar nombres visibles salvo ADMIN; code inmutable.
- `RolePermissionsPage.tsx`: roles dinámicos y nombres desde API; GET/PUT /auth/module-permissions y /auth/action-permissions; GET/PUT /auth/menu-permissions. Las 17 acciones y los menús proceden del catálogo técnico; se muestran las dependencias de acceso adicionales y los roles de sistema pueden recibir concesiones explícitas por datos; ADMIN protegido y excluido de los PUT. Roles propios no asignables/editables antes de su habilitación.
- `UserWarehousesPage.tsx`: roles del catálogo por empresa en alta y edición; GET/POST /auth/users y endpoints de almacenes existentes. Lista/refresco con claves de caché por usuario, empresa y rol; no se envía una empresa elegible en el payload de alta.
- `permissionsApi.ts` y `useServerPermissions.ts`: GET /auth/permissions/me, snapshot efectivo de rol/nombre, módulos, acciones, menús, inicio permitido y flag. Carga, error o respuesta inválida deniegan; sin bypass local ADMIN. La sesión recibe el nombre/rol vigente sin cerrar sesión, con invalidación al guardar y refresco periódico de 30 segundos.
- Sidebar, RoleProtectedRoute, roleNavigation, CommandPalette y KeyboardShortcuts usan el snapshot. Se retiran las 72 listas de rutas y las listas funcionales del menú/atajos. Se preservan metadatos de presentación (etiquetas/iconos), no autorizaciones locales.
- `useRolePermissions.ts` es una fachada del servidor: M1 usa módulos+acciones; M2/M4 usan ayudas de presentación del snapshot que conservan los accesos de creación de la UI anterior, sin afirmar nuevas restricciones HTTP. `useInvoiceWritePermission.ts` usa escritura M1+INVOICE_EMIT; reenvío, puente, DLQ, lote y series consultan sus capacidades. Los estados y condiciones operativas se conservan.
- Código de rol abierto; aliases ACCOUNTANT→CONTADOR y OPERATOR→OPERADOR_FACTURACION se normalizan en el borde de sesión. El nombre no concede privilegios. La identidad ADMIN solo permanece como reserva de gestión/protección; las capacidades funcionales se consultan al servidor.

Las dos rutas /kardex se asocian a M6 (sus API ya viven bajo /inventory). Con can_view=false la UI también deniega, en lugar de ofrecer una ruta que acabaría rechazada por el back. Los defaults de los cinco roles y aliases conservan sus accesos. No se agregan prefijos al interceptor del back.

## Verificación

Conteos y matriz completa en docs/m1/roles-administrables.md. Suite front final: 201 archivos / 1509 pruebas aprobadas, sin fallos ni omisiones (base: 199 / 1488). Los dos fixtures de fecha ya relativos y la regla fiscal permanecen idénticos al SHA base. TypeScript/Vite aprobados. Pruebas cubren roles/nombres dinámicos, menús, protección ADMIN, carga/error denegados, aliases, rol nuevo sin permisos y renombrado sin logout. Los fixtures API de test están fuera del código de producción.

Verificación de navegador con respuestas locales: renombrado, menú guardado, ADMIN bloqueado y alta propia deshabilitada; 1366 px y 360 px, sin errores de página ni desbordamiento de página a 360 px. El harness temporal y las capturas no forman parte del ferry. Sin PRs, merges, despliegue ni SQL compartido/producción.
