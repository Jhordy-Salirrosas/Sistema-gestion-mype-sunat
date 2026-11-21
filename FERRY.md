# Ferry — API directa a Render

- Rama de transporte: `ferry/m1-api-directa-render`.
- Repositorio destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base del front: `fb2d8c3e07ff2ec72daf059d1eda58adf3ca94ed` (main, PR #365).
- Base del repositorio de transporte: `627e29f56e4f090d06b2349f58a63408773ffcf6`.

## Cambio

En producción, cuando no se define `VITE_API_URL`, el valor predeterminado es
`https://sistema-mype-sunat-back.onrender.com/api/v1`. La URL efectiva conserva
exactamente el prefijo `/api/v1`, usando el normalizador existente. Se incluye
el prefijo también en el valor original de ENV para conservar las rutas de los
consumidores que usan esa configuración directamente.

Fuera de producción se mantiene `/api/v1`. Una `VITE_API_URL` explícita sigue
prevaleciendo. Vite incorpora esta variable durante el build; cambiarla requiere
reconstruir el front. `BACKEND_URL` es una variable distinta del proxy en ejecución.

Login y permisos utilizan el cliente centralizado, con `withCredentials: true`,
Authorization Bearer y X-Tenant-Id según la sesión, sin cambios. El usuario confirmó
que el back admite el origen de Pages con credenciales y que la cookie de refresh
usa SameSite=None en producción. No se ha desplegado ni certificado una nueva
sesión en producción como parte de esta entrega.

La Pages Function, `_routes.json` y `wrangler.toml` permanecen intactos. La ruta
normal deja de pasar por el proxy. Se conserva la excepción preexistente del
servicio de login: ante error de red o 502/503/504 intenta `/api/v1/auth/login`
en el mismo origen. No se elimina ese fallback porque el alcance prohíbe cambios
en servicios; por ello el proxy sigue siendo alcanzable en ese caso excepcional.

No se cambian los dos mensajes actuales de 429, el tratamiento de 401, la pausa
de permisos por Retry-After, el refresh, los servicios, tipos, payloads, pantallas
ni archivos del back. El refresh actual no tiene backoff; queda sin modificaciones.

## Inventario del delta

| Archivo | Cambio |
| --- | --- |
| `src/config/env.config.ts` | Predeterminado de producción directo; misma variable y normalización. |
| `test/unit/lib/apiClient.test.ts` | Siete pruebas con cliente y servicios reales, sustituyendo solo el adaptador de transporte. |

Las pruebas certifican el valor original y la URL efectiva de producción, el
valor local, el override de reversión y las variantes de barra final sin duplicar
el prefijo; login y permisos con credenciales, token y empresa; propagación de
429 sin reintentos y conservación literal de ambos avisos honestos. Las pruebas
existentes de render de login 429/401 y de pausa de permisos se mantienen intactas.

## Verificaciones

- Pruebas dirigidas de cliente, rate limit y utilidades: 3 archivos, 28 pruebas aprobadas.
- `npm test -- --reporter=json`: **224 archivos, 1667 pruebas aprobadas, 0 fallidas y 0 omitidas**.
- `npm run build`: aprobado (TypeScript y Vite); predeterminado directo comprobado en el bundle generado.
- ESLint de los dos archivos: 0 errores y 0 advertencias.
- `git diff --check` y `sha256sum -c SHA256SUMS`: verificados al entregar.
- Los dos archivos de `frontend/` coinciden byte a byte con el árbol probado.

## Aplicación y reversión

Copiar los dos archivos de `frontend/` a sus mismas rutas en el front. No hay
eliminaciones. Revisar cambios posteriores si main ha avanzado. Este ferry es un
delta, no una copia completa del repositorio.

Para volver al proxy, configurar **`VITE_API_URL=/api/v1`** y reconstruir el front.
Alternativamente, volver el predeterminado de producción a `/api/v1` en
`src/config/env.config.ts`. Es el literal `/api/v1`, nunca `/api`: el normalizador
actual convertiría `/api` en `/api/api/v1`. No se requiere modificar la Function.

Este paquete no cambia variables de Cloudflare ni realiza despliegues.
Sin PRs, merges ni cambios en el back o en datos de producción.
