# Ferry — Roles administrables, parte 5: navegación de inventario

Rama: `ferry/roles-cutover-front`.
Base back main: `d4d362f602452caee2ae26648d3971597904d4c4`.
Repositorio front: CarlosSoles/Fronted-sistema-mype-sunat.
Base front: `9d188381c0f63c13143576f499b0b58d0f23f9bd`.

La base front avanzó respecto a la fase 0 (`21c662f`); se conserva su main
actual para no sobrescribir los cambios de contabilidad/navegación del equipo.
El delta funcional sigue siendo exclusivamente la decisión aprobada: retirar
las dos listas ADMIN de /inventory/adjustments y /inventory/opening y seguir
el snapshot del servidor. También se retiran el campo de metadata y su filtro,
que ya no tienen usos. No se añade enforcement al back.

Aplicar únicamente los archivos frontend/ enumerados en SHA256SUMS,
retirando ese prefijo, sobre la base front indicada. Verificar antes
`sha256sum -c SHA256SUMS` desde la raíz del back. El espejo heredado contiene
otros ferries: no copiar ni eliminar sus archivos como parte de este paquete.

No cambian endpoints ni payloads: Sidebar, rutas y paleta usan
GET /auth/permissions/me. La API manda para roles del sistema y propios,
incluido ADMIN cuando recibe una denegación. Las concesiones explícitas de
menús siguen filtradas por módulo y los demás controles existentes del back.
La diferencia visible aprobada es que un rol distinto de ADMIN puede ver esos
dos enlaces si el servidor se los concede. No se promete equivalencia con el
filtro local anterior en estos dos enlaces: su eliminación fue aprobada.

Rama backend relacionada: feat/roles-cutover. La ventana y la habilitación son
posteriores: este ferry no cambia ROLES_CUSTOM_ENABLED ni configura despliegues.
No hay dependencias nuevas ni archivos que eliminar en el front.

## Inventario

- src/components/layout/Sidebar.tsx
- test/unit/modules/auth/rolesCutoverNavigation.test.tsx

## Verificación

La suite nueva prueba rol propio autorizado, cinco roles de sistema con
concesión, rol propio denegado y ADMIN denegado, y coincidencia de sidebar,
paleta y ruta directa. Las otras pruebas de equivalencia de cinco roles/alias,
carga/error y permisos dinámicos permanecen vigentes.

Suite completa: 216 → 217 archivos, 1586 → 1595 pruebas aprobadas;
cero fallos y cero omisiones. Pruebas dirigidas: 23 casos en dos archivos.
TypeScript/Vite aprobado. ESLint del delta: cero errores; permanece la
advertencia anterior por NAV_ITEMS exportado desde Sidebar. No cambia el
interceptor de refresh ni el manejo de permisos/429 del paquete anterior.
