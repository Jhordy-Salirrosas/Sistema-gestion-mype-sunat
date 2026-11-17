# Ferry — Mensajes y pausa ante HTTP 429

Rama back: `fix/m1-auth-429`.
Base back main: `d4d362f602452caee2ae26648d3971597904d4c4`.
Repositorio front: CarlosSoles/Fronted-sistema-mype-sunat.
Base front solicitada: `95d78a4cad9cf015384529df34705ef1e95ec933`.

## Aplicación

Verificar `sha256sum -c SHA256SUMS` en la raíz del back. Copiar únicamente los
archivos `frontend/` enumerados en ese manifiesto, retirando dicho prefijo,
sobre el repositorio front. El espejo heredado contiene archivos de otros
ferries: no copiarlos ni eliminarlos como parte de este paquete. No hay
cambios de dependencias ni archivos que eliminar en el front.

## Comportamiento

- apiErrors expone el estado HTTP. Para 429 prioriza «Demasiados intentos,
  espera un momento e inténtalo de nuevo», incluso si el cuerpo de la respuesta
  contiene un mensaje de credenciales. Login mantiene el mensaje actual de
  credenciales ante 401.
- RoleProtectedRoute y la redirección de inicio muestran el aviso de límite
  para el error 429 de permisos. La explicación del servidor despertando se
  conserva para otros errores. El botón manual no permite evitar la pausa.
- useServerPermissions pausa GET `/auth/permissions/me` según Retry-After
  (segundos o fecha HTTP). Sin cabecera válida espera 60 segundos, frente al
  sondeo habitual de 30. Un plazo cero o ya vencido deja un mínimo de 1 segundo
  para evitar una repetición inmediata.
- La pausa se comparte entre observadores de la misma consulta, con la clave
  existente por usuario/empresa/rol, y no se adelanta por reintentos manuales,
  invalidación, reconexión ni remontaje mientras esa consulta sigue en caché.
  Al vencer, se consulta automáticamente; después de un éxito vuelve el sondeo
  habitual. Un nuevo 429 establece su propio plazo. Los permisos siguen
  denegados durante carga/error, incluso si existían datos anteriores.

Se usan los contratos existentes de login y permisos; se lee la cabecera HTTP
Retry-After cuando está disponible para el navegador. No se modifica el
interceptor de refresh: la premisa de su bucle de reintentos quedó descartada
en fase 0. No hay cambios de código backend, migraciones, PR ni merge.

## Inventario del delta

- `src/lib/apiErrors.ts`
- `src/modules/auth/components/LoginForm.tsx`
- `src/modules/auth/hooks/useServerPermissions.ts`
- `src/routes/RoleProtectedRoute.tsx`
- `src/routes/appRoutes.tsx`
- `test/unit/lib/apiErrors.test.ts`
- `test/unit/modules/auth/authRateLimit.test.tsx`

## Verificación

| Conteo | Base front 95d78a4 | Final |
| --- | ---: | ---: |
| Archivos de pruebas | 213 | 214 |
| Pruebas aprobadas | 1559 | 1573 |
| Pruebas fallidas | 0 | 0 |
| Pruebas omitidas | 0 | 0 |

Suite completa: `npm test` (reporter JSON para guardar los conteos). Build:
`npm run build`, aprobado. ESLint sobre los siete archivos tocados, aprobado.
No se ejecuta suite del back porque el delta contiene únicamente el ferry.

Pruebas dirigidas: 2 archivos y 20 casos aprobados; incluyen las pruebas
previas de apiErrors y 14 casos nuevos. Se verifican login 429 y 401, prioridad
del 429 sobre un texto incorrecto de credenciales del backend, aviso de
permisos 429, presentación genérica conservada para otros errores,
Retry-After en segundos y fecha HTTP, cabeceras ausentes/inválidas, ausencia
de llamadas al segundo 30, bloqueo de reintentos adelantados, remontaje de
observadores, reanudación automática y aislamiento por empresa.
