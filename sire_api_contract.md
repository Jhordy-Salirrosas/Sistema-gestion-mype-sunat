# Contrato de API SIRE

Documento de referencia de **todos** los endpoints del módulo SIRE
(`src/modules/sire`). Describe, endpoint por endpoint, la petición y la
respuesta exactas.

- **Base**: `api/v1/sire`
- **Autenticación**: `Authorization: Bearer <token>` en todas las rutas salvo
  indicación contraria. Se aplica `AuthGuard` en todos los controladores SIRE.
- **Empresa**: se toma **siempre** de la sesión (`TokenPayload.companyId`). El
  RUC **nunca** se acepta desde el cuerpo ni desde la query. Si la sesión no
  tiene empresa, la respuesta es `401` con el mensaje
  `La empresa del usuario no está definida.`
- **Content-Type**: `application/json`, salvo los endpoints de fichero, que
  usan `multipart/form-data`.

## Convenciones

### Periodo

Formato `AAAAMM` con mes real: `202401` sí, `202413` no, `202400` no.
Regex: `/^(?!0000)\d{4}(0[1-9]|1[0-2])$/`.

### Libros

| Valor API | Significado | Código SUNAT (`bookCode`) |
| --- | --- | --- |
| `RVIE_VENTAS` | Registro de Ventas e Ingresos Electrónico | `140000` |
| `RCE_COMPRAS` | Registro de Compras Electrónico | `080000` |

En el módulo SIRE clásico (`SireController`) las consultas de solo lectura
aceptan además los alias `RVIE` y `RCE`, que se normalizan internamente a
`RVIE_VENTAS` / `RCE_COMPRAS`.

### Estados de trabajo asíncrono

`PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`.

### Validación de la petición

La `ValidationPipe` global está configurada con
`whitelist: true, forbidNonWhitelisted: true, transform: true`. Por tanto:

- Un **campo desconocido** en el cuerpo o en la query produce `400`.
- Un campo declarado pero vacío (`""`) en un campo obligatorio produce `400`.

### Formato de error

NestJS devuelve el error con esta forma:

```json
{
  "statusCode": 400,
  "message": "La empresa del usuario no está definida.",
  "error": "Bad Request"
}
```

Cuando el mensaje es un array de validaciones, `message` es un array de
strings.

---

## 1. Configuración SIRE de la empresa

Las credenciales SIRE/SUNAT se guardan **una sola vez**, cifradas
(AES-256-GCM) en la tabla `sire_configurations`, asociadas a la empresa de la
sesión. El backend las resuelve desde ahí cuando un trabajo necesita hablar
con SUNAT: **el frontend nunca vuelve a enviarlas**.

> Todas las rutas de este documento son autenticadas (`AuthGuard`) y toman la
> empresa del **token** (`companyId`), nunca del cuerpo de la petición. Cada
> consulta al repositorio filtra por `company_id`, de modo que una empresa no
> puede leer ni escribir datos de otra. Si un recurso (importación, reporte,
> conciliación) no pertenece a la empresa de la sesión, la respuesta es `404`.
> La empresa se toma del token también en `POST /api/v1/sire/configuracion`:
> enviar un `companyId` en el cuerpo no cambia nada (y es un `400`, porque el
> cuerpo no admite propiedades desconocidas).

### 1.1 `POST /api/v1/sire/configuracion`

Guarda o actualiza las credenciales. Los campos **no enviados se conservan**
tal como estaban; por eso se puede enviar solo lo que cambió.

**Request body** — todos los campos opcionales:

| Campo | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `clientId` | string | ≤ 200 chars, no vacío | Client ID de la aplicación en la API SIRE de SUNAT |
| `clientSecret` | string | ≤ 400 chars, no vacío | Client Secret de la aplicación en la API SIRE de SUNAT |
| `solUser` | string | ≤ 50 chars, no vacío, sin espacios | Usuario de la clave SOL |
| `solPassword` | string | ≤ 128 chars, no vacío | Contraseña de la clave SOL |

Ejemplo:

```http
POST /api/v1/sire/configuracion
Content-Type: application/json

{
  "clientId": "abc123XYZ",
  "clientSecret": "s3cr3t",
  "solUser": "USUARIOMYPE",
  "solPassword": "clave-sol"
}
```

**Response `200`**

```json
{
  "configured": true
}
```

`configured` es `true` cuando la empresa tiene las cuatro credenciales
(`clientId`, `clientSecret`, `solUser`, `solPassword`) presentes y no vacías.

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | Cuerpo vacío o sin ninguna credencial: `No se recibió ninguna credencial SIRE para guardar.` |
| `400` | `solUser` con espacios, o valor vacío/no string, o longitud excedida |
| `400` | Propiedad desconocida en el cuerpo |
| `401` | La sesión no tiene empresa |

### 1.2 `GET /api/v1/sire/configuracion/status`

Devuelve si la empresa ya tiene la configuración SIRE completa. No devuelve
ni las credenciales ni parte de ellas.

**Response `200`**

```json
{
  "configured": true
}
```

**Errores**: `401` si la sesión no tiene empresa.

---

## 2. Menú SIRE

Flujos de la pantalla principal del menú: importar una propuesta, conciliarla,
ver el resumen, reportarla a SUNAT y consultar el historial.

### 2.1 `POST /api/v1/sire/importar`

Importa una propuesta SIRE. El trabajo es **asíncrono**: se devuelve `202` con
un `messageId` para el sondeo.

**Content-Type**: `multipart/form-data`

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `file` | fichero | sí | Propuesta SIRE `.txt` o `.zip`. Máximo 5 MB |
| `periodo` | string | no | `AAAAMM`. Si falta se deduce del nombre del archivo |
| `libro` | `RVIE_VENTAS` \| `RCE_COMPRAS` | no | Si falta se deduce del nombre del archivo |

El nombre del archivo **debe** cumplir el formato oficial
`LE<RUC>-<LIBRO>-<PERIODO>.zip` (por ejemplo `LE20601030013-RCE-202401.zip`):
el prefijo `LE` y el RUC de la empresa de la sesión son obligatorios.

**Response `202`**

```json
{
  "messageId": "8b1f0c4e-2f5b-4a9f-9c1e-2d7b0a6f3e11",
  "importacionId": "0f2c9e77-6d0e-4f2b-9d0a-1c3f5b7e9a22",
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "nombreArchivo": "LE20601030013-RCE-202401.zip",
  "estado": "PENDING",
  "rutaArchivo": "sire/20601030013/202401/LE20601030013-RCE-202401.zip",
  "backendAlmacen": "supabase",
  "hashArchivo": "9f2b…",
  "bytes": 48213,
  "createdAt": "2026-11-15T12:00:00.000Z"
}
```

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | Falta el archivo: `Falta el archivo de la propuesta SIRE.` |
| `400` | Archivo vacío |
| `400` | Extensión no permitida (solo `.txt` y `.zip`): `Solo se permiten archivos .txt o .zip.` |
| `400` | El nombre no empieza por `LE`: `El archivo debe comenzar con "LE" (formato oficial LE<RUC>-<LIBRO>-<PERIODO>).` |
| `400` | El nombre no contiene el RUC de la empresa de la sesión: `El nombre del archivo debe contener el RUC {ruc}.` |
| `400` | No se pudo determinar periodo y libro: `No se pudo determinar el periodo y el libro de la importación. Envíelos en el cuerpo o use un archivo con el formato LE<RUC>-<LIBRO>-<PERIODO>.` |
| `404` | La empresa de la sesión no existe: `No se encontró la empresa del usuario.` |
| `503` | La cola no aceptó el trabajo: `No se pudo registrar la importación SIRE en la cola.` |

Todos los errores de validación de la subida devuelven `400` con un `message`
legible en español, nunca con un error interno ni con un `500`.

### 2.2 `GET /api/v1/sire/importar/estado/:messageId`

Estado de una importación en curso. Solo lee la base de datos.

`:messageId` debe ser un UUID válido.

**Response `200`**

```json
{
  "messageId": "8b1f0c4e-2f5b-4a9f-9c1e-2d7b0a6f3e11",
  "estado": "COMPLETED",
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "createdAt": "2026-11-15T12:00:00.000Z",
  "completedAt": "2026-11-15T12:00:05.000Z",
  "errorCode": null,
  "message": null,
  "ticket": null
}
```

`errorCode` lleva el motivo del fallo (`QUEUE_ENQUEUE_FAILED`, etc.) cuando
`estado` es `FAILED`.

`message` es el texto **listo para mostrar**: cuando el worker falla, el
backend lo deja escrito para que el frontend no tenga que traducir el
`errorCode`. Es `null` mientras el trabajo no ha fallado. Nunca contiene
detalles internos del error.

| `errorCode` | `message` |
| --- | --- |
| `QUEUE_ENQUEUE_FAILED` | No se pudo registrar el trabajo en la cola de procesamiento. Inténtalo de nuevo en unos minutos. |
| `SIRE_RETRIES_EXHAUSTED` | El trabajo falló varias veces y pasó a la cola de errores. Revisa el archivo e inténtalo de nuevo. |
| `ARCHIVO_INVALIDO` | El archivo no cumple el formato de una propuesta SIRE. Revisa el nombre y el contenido e inténtalo de nuevo. |
| `ALMACENAMIENTO_ERROR` | No se pudo guardar el archivo del trabajo. Inténtalo de nuevo en unos minutos. |
| `PROCESAMIENTO_ERROR` | No se pudo completar el trabajo. Inténtalo de nuevo en unos minutos. |
| cualquier otro | No se pudo completar el trabajo. Inténtalo de nuevo en unos minutos. |

El endpoint **nunca** devuelve `500` por un fallo del worker: un trabajo fallido
se informa con `200` y `estado: "FAILED"`.

**Errores**: `400` si el `messageId` no es UUID, `404` si la importación no
existe: `No se encontró la importación SIRE.`

### 2.3 `GET /api/v1/sire/conciliacion`

Conciliación de un periodo.

**Query**

| Parámetro | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `periodo` | string | sí | `AAAAMM` con mes real |
| `libro` | `RVIE_VENTAS` \| `RCE_COMPRAS` | no | Si falta se asume `RVIE_VENTAS` |

**Response `200`**

```json
{
  "conciliacionId": "3d5a8b21-9c4e-4a1b-8f6d-2e7c0a1b3d44",
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "resumen": {
    "periodo": "202401",
    "libro": "RCE",
    "totalComprobantes": 12,
    "conciliados": 10,
    "diferencias": 2,
    "baseImponible": 31250.5,
    "igv": 5625.09,
    "total": 36875.59,
    "importeConciliado": 30625.31,
    "importeConDiferencia": 6250.28,
    "porcentajeConciliado": 83.33
  },
  "comprobantes": [
    {
      "tipo": "01",
      "tipoDescripcion": "Factura",
      "serie": "F001",
      "correlativo": 1,
      "rucEmisor": "20601030013",
      "fechaEmision": "2024-01-12",
      "baseImponible": 1250,
      "igv": 225,
      "total": 1475,
      "estado": "CONCILIADO",
      "diferencia": 0
    }
  ],
  "createdAt": "2026-11-15T12:05:00.000Z"
}
```

**Errores**: `400` por periodo inválido o libro no permitido; `401` sin empresa
en la sesión.

### 2.4 `GET /api/v1/sire/resumen`

Resumen del periodo: importaciones, conciliaciones, reportes y el resumen
simulado.

**Query**: los mismos que `conciliacion` (`periodo` obligatorio, `libro`
opcional).

**Response `200`**

```json
{
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "resumen": {
    "periodo": "202401",
    "libro": "RCE",
    "totalComprobantes": 12,
    "conciliados": 10,
    "diferencias": 2,
    "baseImponible": 31250.5,
    "igv": 5625.09,
    "total": 36875.59,
    "importeConciliado": 30625.31,
    "importeConDiferencia": 6250.28,
    "porcentajeConciliado": 83.33
  },
  "importaciones": 3,
  "conciliaciones": 1,
  "reportes": 0
}
```

**Errores**: `400` por periodo inválido; `401` sin empresa en la sesión.

### 2.5 `POST /api/v1/sire/reportar`

Envía el libro conciliado a SUNAT. También es asíncrono: devuelve `202` con el
ticket y el `messageId`.

**Request body**

| Campo | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `periodo` | string | sí | `AAAAMM` con mes real |
| `libro` | `RVIE_VENTAS` \| `RCE_COMPRAS` | sí | — |

**Response `202`**

```json
{
  "messageId": "c1a2b3d4-1111-2222-3333-444455556666",
  "reporteId": "aa11bb22-cc33-dd44-ee55-ff6677889900",
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "estado": "PENDING",
  "ticket": "12345678",
  "createdAt": "2026-11-15T12:10:00.000Z"
}
```

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | Periodo o libro inválidos |
| `401` | La sesión no tiene empresa |
| `503` | La cola no aceptó el trabajo: `No se pudo registrar el reporte SIRE en la cola.` |

### 2.6 `GET /api/v1/sire/reportar/estado/:messageId`

Estado de un reporte en curso. Solo lee la base de datos.

**Response `200`**: mismo esquema que `2.2`, con `ticket` informado cuando el
reporte ya lo tiene.

```json
{
  "messageId": "c1a2b3d4-1111-2222-3333-444455556666",
  "estado": "COMPLETED",
  "periodo": "202401",
  "libro": "RCE_COMPRAS",
  "createdAt": "2026-11-15T12:10:00.000Z",
  "completedAt": "2026-11-15T12:10:03.000Z",
  "errorCode": null,
  "message": null,
  "ticket": "12345678"
}
```

Igual que en `2.2`, `message` es el texto listo para mostrar cuando
`estado` es `FAILED` y `null` en caso contrario.

**Errores**: `400` si el `messageId` no es UUID, `404` si el reporte no existe:
`No se encontró el reporte SIRE.`

### 2.7 `GET /api/v1/sire/historial`

Historial unificado de importaciones, conciliaciones y reportes.

**Query**

| Parámetro | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `periodo` | string | no | `AAAAMM` con mes real |
| `limite` | number | no | Entero, 1–200 |

**Response `200`**

```json
{
  "total": 5,
  "filas": [
    {
      "id": "0f2c9e77-6d0e-4f2b-9d0a-1c3f5b7e9a22",
      "fecha": "2026-11-15T12:00:00.000Z",
      "tipoAccion": "IMPORTACION",
      "periodo": "202401",
      "estado": "COMPLETED",
      "detalle": "LE20601030013-RCE-202401.zip"
    }
  ]
}
```

`tipoAccion` es `IMPORTACION`, `CONCILIACION` o `REPORTE`.

**Errores**: `400` por periodo o límite inválidos; `401` sin empresa en la
sesión.

---

## 3. Consulta de períodos SIRE (API SUNAT)

Consulta de períodos a SUNAT. Se procesa en segundo plano: el `POST` devuelve
`202` con un `messageId` y el trabajo se resuelve con un `GET` de estado.

> Las credenciales SOL **no se envían en el cuerpo**. Se resuelven desde
> `POST /api/v1/sire/configuracion`. Los campos `solUser` y `solPassword` se
> mantienen en el DTO por compatibilidad con clientes antiguos, pero se
> **ignoran**.

### 3.1 `POST /api/v1/sire/periodos`

**Request body**

| Campo | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `bookCode` | `140000` \| `080000` | sí | `140000` = RVIE, `080000` = RCE |
| `solUser` | string | no | **Deprecado**, se ignora |
| `solPassword` | string | no | **Deprecado**, se ignora |

Ejemplo:

```http
POST /api/v1/sire/periodos
Content-Type: application/json

{
  "bookCode": "140000"
}
```

**Response `202`**

```json
{
  "messageId": "7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70",
  "status": "PENDING"
}
```

Si la cola (PgBoss) no está disponible, la respuesta **sigue siendo `202`**
con un estado controlado, para que el frontend siempre reciba JSON:

```json
{
  "messageId": "7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70",
  "status": "FAILED",
  "errorCode": "QUEUE_ENQUEUE_FAILED",
  "message": "La cola de trabajos SIRE no está disponible en este momento.",
  "error": "La cola de trabajos SIRE no está disponible en este momento."
}
```

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | `bookCode` ausente o distinto de `140000` / `080000`; propiedad desconocida |
| `401` | La sesión no tiene empresa |
| `404` | La empresa de la sesión no existe o está inactiva: `No se encontró una empresa activa para la sesión.` |
| `500` | No se pudo registrar la consulta en la base de datos |
| `503` | La integración SIRE no está habilitada en el entorno |

### 3.2 `GET /api/v1/sire/periodos/status/:messageId`

Estado de la consulta de períodos. Solo lee la base de datos: no llama a SUNAT.

`:messageId` debe ser un UUID válido.

**Response `200`**

```json
{
  "messageId": "7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70",
  "status": "COMPLETED",
  "bookCode": "140000",
  "periods": [
    { "periodo": "202401", "estado": "PENDIENTE" }
  ],
  "createdAt": "2026-11-15T12:20:00.000Z",
  "completedAt": "2026-11-15T12:20:04.000Z"
}
```

Cuando la consulta falló, se añaden `message`, `error` y `errorCode`:

```json
{
  "messageId": "7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70",
  "status": "FAILED",
  "bookCode": "140000",
  "message": "SUNAT no pudo completar la consulta en este momento.",
  "error": "SUNAT no pudo completar la consulta en este momento.",
  "errorCode": "SUNAT_UNAVAILABLE",
  "createdAt": "2026-11-15T12:20:00.000Z",
  "completedAt": "2026-11-15T12:20:04.000Z"
}
```

**Códigos de error** (`errorCode`)

| Código | Significado |
| --- | --- |
| `REQUEST_CONTEXT_INVALID` | El trabajo no corresponde a la empresa/ruc/libro solicitados |
| `CREDENTIALS_UNAVAILABLE` | La empresa no tiene credenciales SIRE configuradas |
| `QUEUE_ENQUEUE_FAILED` | No se pudo publicar el trabajo en la cola |
| `SUNAT_HTTP_400` / `SUNAT_HTTP_422` / `SUNAT_HTTP_500` / `SUNAT_HTTP_502` / `SUNAT_HTTP_503` | Error HTTP devuelto por SUNAT |
| `SUNAT_AUTH_FAILED` | Token de autenticación rechazado |
| `SUNAT_UNAVAILABLE` | SUNAT no disponible |
| `SUNAT_TIMEOUT` | Tiempo de espera agotado |
| `SUNAT_TRANSPORT_ERROR` | Fallo de red |
| `SUNAT_RETRIES_EXHAUSTED` | Se agotaron los reintentos (cola DLQ) |
| `SUNAT_BAD_RESPONSE` | Respuesta con formato inesperado |
| `SUNAT_REQUEST_FAILED` | Fallo genérico de la petición |
| `SIRE_NOT_CONFIGURED` | La integración no está habilitada en el entorno |

**Errores**: `400` si el `messageId` no es UUID, `404` si la solicitud no
existe: `No se encontró la solicitud SIRE.`

---

## 4. SIRE clásico (`SireController`)

Se expone bajo dos prefijos equivalentes: `api/v1/sire` y `sire`. Es decir,
`POST /api/v1/sire/reconcile` y `POST /sire/reconcile` hacen lo mismo.

### 4.1 `POST /api/v1/sire/reconcile` → `200`

Conciliación local contra los registros declarados por el cliente.

**Request body**

| Campo | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `period` | string | sí | `AAAAMM` con mes real |
| `bookType` | `RVIE_VENTAS` \| `RCE_COMPRAS` | sí | — |
| `localRecords` | array | sí | Registros locales (ver abajo) |

Cada elemento de `localRecords`:

| Campo | Tipo | Restricciones |
| --- | --- | --- |
| `emitterRuc` | string | 11 dígitos |
| `documentType` | string | `01`, `03`, `07` u `08` |
| `series` | string | No vacío |
| `correlative` | string | Solo dígitos, no vacío |
| `taxableBase` | number | ≥ 0, máx. 2 decimales |
| `igvAmount` | number | ≥ 0, máx. 2 decimales |
| `totalAmount` | number | ≥ 0, máx. 2 decimales |

**Response `200`**

```json
{
  "period": "202401",
  "bookType": "RVIE_VENTAS",
  "totalLocalRecords": 10,
  "totalSireRecords": 12,
  "exactMatchesCount": 9,
  "discrepanciesCount": 3,
  "complianceRate": 75,
  "discrepancies": [
    {
      "type": "DIFERENCIA_MONTOS",
      "localRecord": {},
      "sireRecord": {},
      "description": "El importe total no coincide."
    }
  ]
}
```

`discrepancies[].type` puede ser `COINCIDENCIA_EXACTA`, `DIFERENCIA_MONTOS`,
`OMISION_LOCAL`, `OMISION_SUNAT` o `DUPLICADO_LLAVE`.

### 4.2 `POST /api/v1/sire/import` → `201`

Importa una propuesta en formato TXT.

**Content-Type**: `multipart/form-data`, campo `file` (`.txt`, máx. 5 MB).
Body: `period` (`AAAAMM`) y `bookType` (`RVIE_VENTAS` | `RCE_COMPRAS`).

**Response `201`**

```json
{
  "imported": 120,
  "rejected": 2,
  "errors": [{ "line": 45, "reason": "El CAR no tiene 27 dígitos." }],
  "formatStatus": "PROVISIONAL_NOT_OFFICIAL"
}
```

**Errores**: `400` `Falta el archivo TXT.` / `El archivo está vacío.` /
`El archivo no contiene filas importables.`

### 4.3 `POST /api/v1/sire/upload` → `201`

Carga el reporte de SUNAT en CSV o XLSX.

**Content-Type**: `multipart/form-data`, campo `file` (`.csv` o `.xlsx`, máx.
5 MB). Body: `period` y `bookType`.

**Response `201`**

```json
{
  "imported": 120,
  "rejected": 0,
  "errors": [],
  "fileHash": "9f2b…",
  "fileName": "20601030013-140000-202401.csv",
  "reportType": "RVIE"
}
```

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | `Falta el archivo CSV/XLSX.` / `El archivo está vacío.` / `El archivo no contiene filas válidas.` |
| `415` | Extensión distinta de `.csv` o `.xlsx` |
| `409` | El mismo archivo (mismo hash) ya fue cargado para la empresa |

### 4.4 `POST /api/v1/sire/proposal` → `201` y `GET /api/v1/sire/propuesta` → `200`

Obtiene la propuesta de SUNAT para un periodo y la persiste localmente.

- `POST /api/v1/sire/proposal`: body `period` + `bookType`.
- `GET /api/v1/sire/propuesta`: query `periodo` (`AAAAMM`) y `libro`
  (`RVIE` | `RCE` | `RVIE_VENTAS` | `RCE_COMPRAS`); `ruc` es opcional y se
  ignora.

**Response `200` / `201`**

```json
{
  "period": "202401",
  "bookType": "RVIE_VENTAS",
  "state": "PROPUESTA",
  "count": 12,
  "proposals": []
}
```

### 4.5 `POST /api/v1/sire/excluir` y `DELETE /api/v1/sire/proposal/:proposalId` → `201`

Excluye un registro de la propuesta. `DELETE` usa el mismo cuerpo.

**Request body** (`POST`)

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| `proposalId` | string | sí |
| `carSunat` | string | no |
| `reason` | string | no |

**Response `201`**

```json
{
  "proposalId": "abc-123",
  "excluded": true
}
```

### 4.6 `POST /api/v1/sire/restaurar` → `201`

Restaura un registro excluido.

**Request body**: `proposalId` (string, obligatorio), `carSunat` y `reason`
opcionales.

**Response `201`**

```json
{
  "proposalId": "abc-123",
  "restored": true
}
```

### 4.7 `POST /api/v1/sire/aceptar` → `201`

Acepta la propuesta del periodo.

**Request body**: `period` (`AAAAMM`), `bookType`
(`RVIE_VENTAS` | `RCE_COMPRAS`), `confirmed` (boolean, obligatorio).

**Response `201`**

```json
{
  "ticket": "87654321",
  "state": "PROCESANDO_PRELIMINAR"
}
```

### 4.8 `GET /api/v1/sire/preliminar` → `200`

Estado preliminar y registros del periodo.

**Query**: `periodo` (`AAAAMM`), `libro` (`RVIE` | `RCE` |
`RVIE_VENTAS` | `RCE_COMPRAS`), `ruc` opcional (se ignora).

**Response `200`**

```json
{
  "period": "202401",
  "bookType": "RVIE_VENTAS",
  "state": "SIN_PROPUESTA",
  "records": []
}
```

### 4.9 `POST /api/v1/sire/preliminar`, `POST /api/v1/sire/preliminary` → `201`

Registra el preliminar del periodo. Body: `period` + `bookType`.

**Response `201`**

```json
{
  "ticket": "87654321",
  "state": "PROCESANDO_PRELIMINAR"
}
```

### 4.10 `DELETE /api/v1/sire/preliminary` → `200`

Elimina el preliminar del periodo. Body: `period` + `bookType`.

**Response `200`**

```json
{
  "ticket": "87654321",
  "state": "PROCESANDO_ELIMINACION"
}
```

### 4.11 `POST /api/v1/sire/generate` → `201`

Genera el registro del periodo. Body: `period` + `bookType`.

**Response `201`**

```json
{
  "ticket": "87654321",
  "state": "PROCESANDO_GENERACION"
}
```

### 4.12 `GET /api/v1/sire/generado` → `200`

Registro generado y sus registros.

**Query**: `periodo` + `libro`.

**Response `200`**

```json
{
  "period": "202401",
  "bookType": "RVIE_VENTAS",
  "state": "SIN_REGISTRO",
  "records": []
}
```

### 4.13 `GET /api/v1/sire/status` y `POST /api/v1/sire/tickets/:period/poll` → `201`

Consulta el estado de un ticket.

- `GET /api/v1/sire/status`: query `periodo` + `libro`.
- `POST /api/v1/sire/tickets/:period/poll`: path `:period` (`AAAAMM`) y query
  `bookType` (`RVIE_VENTAS` | `RCE_COMPRAS`).

**Response `201`**: el resultado del sondeo del ticket (estado y detalle del
libro en SUNAT).

**Errores**: `400` `El tipo de libro no es válido.`

### 4.14 `POST /api/v1/sire/proposal/replace` y `POST /api/v1/sire/reemplazo` → `201`

Reemplaza la propuesta por una nueva.

**Content-Type**: `multipart/form-data`, campo `file` (`.txt`, máx. 5 MB).
Body: `period` + `bookType`.

**Response `201`**

```json
{
  "ticket": "87654321",
  "state": "PROCESANDO_REEMPLAZO"
}
```

**Errores**: `400` `Falta el archivo TXT.`

### 4.15 `POST /api/v1/sire/export` → `200`

Exporta la conciliación del periodo.

Body: `period` + `bookType`.

**Response `200`** — fichero `text/plain; charset=utf-8` en adjunto, con el
nombre `<period>-<bookType>.txt`:

```
Content-Disposition: attachment; filename="202401-RVIE_VENTAS.txt"
```

**Errores**: `404` `No existe conciliación para el periodo.`

### 4.16 `GET /api/v1/sire/history` → `200`

Historial de conciliaciones cerradas.

**Query**

| Parámetro | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `page` | number | no | Entero ≥ 1 (por defecto 1) |
| `limit` | number | no | Entero 1–100 (por defecto 20) |

**Response `200`**

```json
{
  "page": 1,
  "limit": 20,
  "total": 42,
  "items": [
    {
      "id": "3d5a8b21-9c4e-4a1b-8f6d-2e7c0a1b3d44",
      "period": "202401",
      "bookType": "RVIE",
      "status": "CERRADO",
      "createdAt": "2026-11-15T12:00:00.000Z",
      "complianceRate": 83.33,
      "totalsByScenario": {
        "COINCIDENCIA_EXACTA": 9,
        "DIFERENCIA_MONTOS": 1,
        "OMISION_LOCAL": 1,
        "OMISION_SUNAT": 1,
        "DUPLICADO_LLAVE": 0
      }
    }
  ]
}
```

### 4.17 `POST /api/v1/sire/close` → `200`

Cierra el periodo fiscal.

Body: `period` + `bookType`.

**Response `200`**

```json
{
  "period": "202401",
  "bookType": "RVIE_VENTAS",
  "status": "CERRADO"
}
```

---

## 5. Consulta manual simulada

### 5.1 `POST /api/v1/sire/consulta-manual` → `200`

Simula la consulta de libros por RUC y periodo. **No contacta con SUNAT** y
**no valida, almacena ni transmite la clave SOL**.

**Request body**

| Campo | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `ruc` | string | sí | 11 dígitos. Debe ser el RUC de la empresa de la sesión |
| `period` | string | sí | `AAAAMM` con mes real |
| `solPassword` | string | sí | ≤ 128 chars, no vacío |

> El `ruc` del cuerpo se coteja con el RUC de la empresa autenticada. Si no
> coinciden, la respuesta es `403` con el mensaje
> `El RUC de la consulta debe corresponder a la empresa de la sesión.` y la
> simulación **no** se ejecuta. El RUC que se procesa es siempre el de la
> empresa de la sesión, nunca el enviado por el cliente.

**Response `200`**

```json
{
  "mode": "SIMULATED",
  "sunatContacted": false,
  "solCredentialStored": false,
  "ruc": "20601030013",
  "period": "202401",
  "message": "Resultado simulado. No se consultó SUNAT y la clave SOL no fue validada, almacenada ni transmitida.",
  "modules": [
    {
      "code": "RVIE",
      "name": "Registro de Ventas e Ingresos Electrónico",
      "bookType": "RVIE_VENTAS",
      "relatedRuc": "20601030013",
      "state": "SIMULATED",
      "count": 1,
      "records": [
        {
          "relatedRuc": "20601030013",
          "documentType": "01",
          "series": "FDEM",
          "correlative": "1",
          "issueDate": "2024-01-05",
          "taxableBase": 100,
          "igvAmount": 18,
          "totalAmount": 118,
          "car": "DEMO-RVIE-202401-001"
        }
      ]
    },
    {
      "code": "RCE",
      "name": "Registro de Compras Electrónico",
      "bookType": "RCE_COMPRAS",
      "relatedRuc": "20601030013",
      "state": "SIMULATED",
      "count": 1,
      "records": []
    }
  ]
}
```

---

## 6. Dashboard y métricas de resiliencia

### 6.1 `GET /api/v1/sire/dashboard/metrics` → `200`

Métricas de resiliencia de la empresa: estado del circuit breaker, tasas de
fallo y lentitud, llamadas y reintentos.

**Response `200`**

```json
{
  "state": "CLOSED",
  "failureRate": 12,
  "slowCallRate": 3,
  "bufferedInvoicesCount": 0,
  "totalCalls": 120,
  "successfulCalls": 105,
  "failedCalls": 15,
  "totalRetries": 4,
  "recentFailedCalls": 2,
  "mttdSeconds": null,
  "mttrSeconds": null,
  "mtbfSeconds": null,
  "activityScope": "company"
}
```

**Errores**: `401` si la sesión no tiene empresa.

### 6.2 `GET /api/v1/sire/dashboard/history` → `200`

Serie temporal de resiliencia.

**Query**

| Parámetro | Tipo | Obligatorio | Restricciones |
| --- | --- | --- | --- |
| `start` | string | sí | Fecha ISO (`@IsDateString`) |
| `end` | string | sí | Fecha ISO, posterior a `start` |
| `granularity` | `minute` \| `hour` \| `day` | sí | — |
| `limit` | number | no | Entero 1–500 (por defecto 100) |
| `offset` | number | no | Entero 0–50000 (por defecto 0) |

**Response `200`**

```json
{
  "data": [
    {
      "timestamp": "2026-11-15T12:00:00.000Z",
      "retries": 1,
      "availabilityPercent": 98.5,
      "observedCalls": 200,
      "successfulCalls": 197,
      "failedCalls": 3
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

**Errores**

| Código | Cuándo |
| --- | --- |
| `400` | Fechas inválidas o `start` ≥ `end` |
| `400` | Granularidad no válida |
| `400` | El rango supera el máximo permitido (365 días o 10 000 cubos) |
| `401` | La sesión no tiene empresa |

### 6.3 Rutas de compatibilidad

Las siguientes rutas devuelven **exactamente la misma carga** que sus
equivalentes principales, y sirven para no romper a clientes que usaban las
rutas antiguas:

| Ruta | Equivalente |
| --- | --- |
| `GET /api/v1/sire/metrics` | `GET /api/v1/sire/dashboard/metrics` |
| `GET /api/v1/resilience/metrics` | `GET /api/v1/sire/dashboard/metrics` |
| `GET /api/v1/resilience/history` | `GET /api/v1/sire/dashboard/history` |
| `GET /api/v1/metrics` | `GET /api/v1/sire/dashboard/metrics` |

---

## Resumen de rutas

| Método | Ruta | Estado | Autenticación |
| --- | --- | --- | --- |
| POST | `/api/v1/sire/configuracion` | 200 | Sí |
| GET | `/api/v1/sire/configuracion/status` | 200 | Sí |
| POST | `/api/v1/sire/importar` | 202 | Sí |
| GET | `/api/v1/sire/importar/estado/:messageId` | 200 | Sí |
| GET | `/api/v1/sire/conciliacion` | 200 | Sí |
| GET | `/api/v1/sire/resumen` | 200 | Sí |
| POST | `/api/v1/sire/reportar` | 202 | Sí |
| GET | `/api/v1/sire/reportar/estado/:messageId` | 200 | Sí |
| GET | `/api/v1/sire/historial` | 200 | Sí |
| POST | `/api/v1/sire/periodos` | 202 | Sí |
| GET | `/api/v1/sire/periodos/status/:messageId` | 200 | Sí |
| POST | `/api/v1/sire/reconcile` | 200 | Sí |
| POST | `/api/v1/sire/import` | 201 | Sí |
| POST | `/api/v1/sire/upload` | 201 | Sí |
| POST | `/api/v1/sire/proposal` | 201 | Sí |
| GET | `/api/v1/sire/propuesta` | 200 | Sí |
| POST | `/api/v1/sire/excluir` | 201 | Sí |
| DELETE | `/api/v1/sire/proposal/:proposalId` | 201 | Sí |
| POST | `/api/v1/sire/restaurar` | 201 | Sí |
| POST | `/api/v1/sire/aceptar` | 201 | Sí |
| GET | `/api/v1/sire/preliminar` | 200 | Sí |
| POST | `/api/v1/sire/preliminar` | 201 |Sí |
| POST | `/api/v1/sire/preliminary` | 201 | Sí |
| DELETE | `/api/v1/sire/preliminary` | 200 | Sí |
| POST | `/api/v1/sire/generate` | 201 | Sí |
| GET | `/api/v1/sire/generado` | 200 | Sí |
| GET | `/api/v1/sire/status` | 201 | Sí |
| POST | `/api/v1/sire/tickets/:period/poll` | 201 | Sí |
| POST | `/api/v1/sire/proposal/replace` | 201 | Sí |
| POST | `/api/v1/sire/reemplazo` | 201 | Sí |
| POST | `/api/v1/sire/export` | 200 | Sí |
| GET | `/api/v1/sire/history` | 200 | Sí |
| POST | `/api/v1/sire/close` | 200 | Sí |
| POST | `/api/v1/sire/consulta-manual` | 200 | Sí |
| GET | `/api/v1/sire/dashboard/metrics` | 200 | Sí |
| GET | `/api/v1/sire/dashboard/history` | 200 | Sí |
| GET | `/api/v1/sire/metrics` | 200 | Sí |
| GET | `/api/v1/resilience/metrics` | 200 | Sí |
| GET | `/api/v1/resilience/history` | 200 | Sí |
| GET | `/api/v1/metrics` | 200 | Sí |

> Las rutas del `SireController` también están disponibles bajo el prefijo
> `/sire` (por ejemplo, `/sire/reconcile`).
