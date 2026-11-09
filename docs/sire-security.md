# SIRE MVP: seguridad, alcance y despliegue

## Alcance implementado

El backend permite cargar propuestas y conciliarlas con datos de la empresa autenticada. Las claves SOL nuevas y las de la empresa demo se cifran con AES-256-GCM antes de persistirse. La clave de cifrado se configura por separado de PostgreSQL mediante `SOL_CREDENTIALS_ENCRYPTION_KEY`; en producción debe inyectarse desde un secret manager/KMS y no desde el repositorio ni desde una imagen.

La clave SOL no se devuelve en las respuestas de registro. El registro audita el almacenamiento cifrado con empresa, usuario, IP y agente de usuario, sin incluir valores de credenciales. En producción, el acceso a datos de autenticación falla cerrado ante errores de base de datos; no usa identidades demo como respuesta de respaldo. El filtro HTTP no devuelve ni registra el mensaje o stack de errores internos. Las cargas son idempotentes cuando el CAR ya existe con los mismos datos; si el CAR existe con datos diferentes, la operación devuelve HTTP 409 y no reemplaza ni borra registros.

## Límite de integración SUNAT

Las operaciones del gateway SIRE general continúan sin cliente real: `SUNAT_SIRE_ENV=mock` solo habilita el gateway simulado fuera de producción; `beta` y `produccion` fallan explícitamente. Existe aparte un cliente limitado a consultar períodos, que solo se activa con `SUNAT_SIRE_INTEGRATION_ENABLED=true`.

El endpoint autenticado `POST /api/v1/sire/consulta-manual` recibe un RUC, periodo y una clave SOL manual para facilitar pruebas del flujo backend. Es una simulación: no valida ni transmite la clave, no la persiste ni la registra, y devuelve ejemplos ficticios para RVIE y RCE ligados al RUC ingresado. La respuesta marca `mode: SIMULATED` y `sunatContacted: false`. Usar solo credenciales ficticias en este endpoint; no debe interpretarse como una consulta a SUNAT ni como una validación de credenciales.

Solicitud de ejemplo, únicamente con datos ficticios:

```json
{
  "ruc": "20100070970",
  "period": "202611",
  "solPassword": "CLAVE_SOL_FICTICIA"
}
```

La clave es requerida solo para probar el formulario manual y se descarta en el controlador: el caso de uso recibe únicamente `ruc` y `period`.

### Consulta de períodos SIRE (solo lectura)

Existe la ruta autenticada `POST /api/v1/sire/periodos`, que devuelve HTTP 202 y `{ "messageId": "...", "status": "PENDING" }` al encolar la consulta de períodos de RVIE (`bookCode: "140000"`) o RCE (`bookCode: "080000"`). El RUC se obtiene de la empresa activa de la sesión; no se acepta un RUC enviado por el cliente. El usuario SOL y la clave SOL se reciben únicamente en el cuerpo HTTPS de esa solicitud. No se guardan en la tabla de consultas ni en texto plano en PgBoss: el payload persistido de la cola guarda las credenciales cifradas con `SOL_CREDENTIALS_ENCRYPTION_KEY`. El worker las descifra solo para realizar la autenticación y no las registra. `SUNAT_CLIENT_ID` y `SUNAT_CLIENT_SECRET` son credenciales de aplicación y deben inyectarse desde un secret manager.

PgBoss reintenta los errores HTTP 500/502 de SUNAT hasta tres veces, con backoff exponencial desde 30 segundos y un máximo de 300 segundos. Al agotar los intentos, el trabajo pasa a la DLQ y la solicitud queda `FAILED`. Otros errores se marcan como fallidos sin reintento automático. La ruta autenticada `GET /api/v1/sire/periodos/status/:messageId` devuelve el estado y, al completarse, los períodos guardados; el acceso se limita a la empresa propietaria. Los errores presentados al cliente son genéricos y no incluyen cuerpos crudos de SUNAT ni credenciales.

La integración permanece desactivada salvo que `SUNAT_SIRE_INTEGRATION_ENABLED=true`. Al activarla, la validación exige `SIRE_AUTH_HOST=https://api-seguridad.sunat.gob.pe`, `SIRE_API_HOST=https://api-sire.sunat.gob.pe`, `SUNAT_CLIENT_ID` y `SUNAT_CLIENT_SECRET`. Habilitar el switch puede transmitir las credenciales SOL a SUNAT y realizar consultas reales. Solo se aceptan los dos hosts exactos mediante HTTPS, en su puerto estándar y sin rutas adicionales. Las rutas OAuth y de consulta deben cotejarse con el manual vigente de SUNAT antes de activar la variable; no se verificó conexión real. Las variables se leen con `ConfigService`; no se codifican credenciales ni hosts en TypeScript.

La tabla `sire_period_queries` requiere aplicar la migración `20261108180000_sire_period_queries` antes del despliegue. El payload de PgBoss conserva únicamente las credenciales SOL cifradas y los identificadores/códigos de empresa, RUC y libro; proteger también el acceso a la base de datos de PgBoss. Las credenciales cifradas siguen siendo sensibles mientras exista el job, por lo que la clave de cifrado debe permanecer disponible y restringida al backend.

Solicitud de ejemplo con valores ficticios:

```json
{
  "bookCode": "140000",
  "solUser": "USUARIO_SOL_FICTICIO",
  "solPassword": "CLAVE_SOL_FICTICIA"
}
```

La consulta exitosa no sustituye una consulta independiente de existencia pública del RUC. Confirma únicamente que SUNAT autorizó la consulta y devolvió una respuesta de períodos para la empresa autenticada.

El parser TXT de nueve columnas es provisional; no debe ofrecerse ni describirse como formato oficial RVIE/RCE. La exportación sigue marcada como `BORRADOR`. Antes de habilitar intercambio automático hay que verificar en publicaciones oficiales SUNAT los servicios, autenticación, anexos y layouts vigentes de cada libro. No se verificó conexión alguna contra SUNAT.

Hasta completar esa verificación, el flujo seguro es importar datos para conciliación. No activar aceptación, reemplazo, complementación, generación ni cierre contra SUNAT. En producción, el backend rechaza peticiones no seguras; detrás de proxy confía en un salto, por lo que el backend debe quedar aislado de acceso directo y el proxy debe sobrescribir `X-Forwarded-Proto`. Configurar HTTPS entre frontend y proxy; no enviar credenciales por HTTP. La auditoría implementada cubre el almacenamiento inicial; aún no existe un servicio de lectura/descifrado ni auditoría de uso, porque ninguna operación SIRE real consume estas credenciales. Al integrar el cliente oficial, el acceso deberá quedar encapsulado por `companyId` y auditarse sin registrar valores.

## Preparación de la clave de cifrado

Generar localmente una clave aleatoria de 32 bytes codificada en Base64:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Guardar el resultado directamente en el secret manager del entorno como `SOL_CREDENTIALS_ENCRYPTION_KEY`. No incluir el valor en el repositorio, tickets, logs, imágenes ni archivos compartidos. Una clave distinta o perdida vuelve irrecuperables las credenciales cifradas. No cambiarla solo reemplazando la variable; una rotación criptográfica requiere descifrar y volver a cifrar todas las filas con una herramienta controlada.

En local y pruebas se puede usar una clave ficticia, no reutilizable en producción. La aplicación falla al arrancar si la clave falta o no es Base64 de exactamente 32 bytes.

## Cifrado de claves preexistentes

No se inspeccionaron bases de datos ni se imprimieron/exportaron valores. Si `companies.sol_pass_encrypted` contiene claves anteriores en texto plano, migrarlas con una conexión directa controlada:

1. Respaldar la base de datos con acceso restringido y configurar la clave externa correcta en el entorno de mantenimiento.
2. Ejecutar `npm run migrate:sol-credentials` para un conteo de simulación. El comando solo informa el número de filas; nunca imprime credenciales.
3. Revisar el conteo y ejecutar `npm run migrate:sol-credentials -- --apply` con `SOL_CREDENTIALS_MIGRATION_CONFIRM=YES`.
4. Verificar el conteo de ciphertext mediante un procedimiento aprobado que no seleccione ni muestre los valores. Conservar la clave de cifrado en el secret manager y restringir acceso al backup.

La migración actualiza las filas dentro de una transacción y no exporta ni copia secretos a archivos. No se ejecutó en este entorno. Si falla, no se debe volver a texto plano. Mantener el despliegue con el código que cifra nuevas credenciales y corregir hacia adelante.

Las credenciales SOL que hayan sido compartidas fuera del gestor autorizado se consideran expuestas. La migración solo cifra su almacenamiento; no invalida una clave conocida. Rotar esas credenciales en SUNAT y luego guardar las nuevas mediante un canal seguro.

## Despliegue y rollback

1. Configurar `SOL_CREDENTIALS_ENCRYPTION_KEY` desde el secret manager y `SUNAT_SIRE_ENV=mock` únicamente en entornos no productivos. `SUNAT_SIRE_ENV=beta` y `produccion` no activan un cliente real actualmente.
2. Desplegar la aplicación, probar registro con datos ficticios y ejecutar las pruebas unitarias descritas abajo.
3. Ejecutar primero la simulación de migración y luego, con autorización operativa, el modo `--apply`.
4. Para rollback, conservar la misma clave externa y usar una versión que entienda el formato `sol:v1`. No volver a una versión que guarde claves nuevas en texto plano y no intentar “desmigrar” a texto plano.
5. No se requiere migración de esquema Prisma para el ciphertext, ya que el campo existente es texto.

## Validación local

```powershell
npm test -- --runInBand test/unit/auth test/unit/common/httpExceptionFilter.spec.ts test/unit/config/env.validation.spec.ts test/unit/sire/sireGatewaySelector.spec.ts test/unit/sire/prismaSireRepository.spec.ts
npm run build
```

Las pruebas usan claves y datos ficticios. No se ejecutan operaciones destructivas ni pruebas de importación, reemplazo o cierre en producción.
