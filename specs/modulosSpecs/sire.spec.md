# Módulo SIRE: conciliación fiscal

## Alcance disponible

La pantalla permite enviar comprobantes locales al endpoint de conciliación y mostrar la respuesta calculada y persistida por el backend. El `companyId` se obtiene del usuario autenticado y no forma parte del cuerpo de la petición.

La importación de propuestas TXT está habilitada usando el formato interno provisional de nueve columnas descrito abajo. Este formato no es el layout oficial SUNAT y la pantalla debe advertirlo antes de cargar archivos. La generación, el reemplazo y la exportación se solicitan mediante las rutas del backend; el modo `mock` simula el flujo y no envía operaciones a SUNAT real.

## Flujo de propuesta, preliminar y generado

La pantalla comparte los selectores de periodo y libro con la conciliación, y ofrece las
pestañas Propuesta, Excluidos, Preliminar y Generado. Las propuestas se consultan con
`POST /api/v1/sire/proposal` y un JSON con `period` y `bookType`; cada elemento de
`proposals` se identifica por `id`, que el cliente conserva como `proposalId` para las
acciones posteriores. No se envía `companyId` ni RUC para estas operaciones: la empresa
se obtiene de la sesión autenticada.

Las lecturas provisionales usan `GET /api/v1/sire/preliminar?periodo=<YYYYMM>&libro=<bookType>`
y `GET /api/v1/sire/generado?periodo=<YYYYMM>&libro=<bookType>`. Las acciones de
aceptación, exclusión, restauración y registro de preliminar envían `period` y `bookType`
en JSON; las acciones de registro identifican la propuesta mediante `proposalId`.
La eliminación usa `DELETE /api/v1/sire/preliminary`, la generación usa
`POST /api/v1/sire/generate`, el reemplazo TXT usa `POST /api/v1/sire/proposal/replace`,
el reporte usa `POST /api/v1/sire/upload` y la exportación usa `POST /api/v1/sire/export`.

El monitor consulta `POST /api/v1/sire/tickets/<period>/poll?bookType=<bookType>` cada
tres segundos mientras el ticket esté pendiente. Al terminar con `TERMINADO` o `ERROR`,
el frontend vuelve a consultar el estado y los registros. No informa éxito para respuestas
de error o tickets pendientes. Todas las rutas requieren Bearer JWT y una respuesta 401
cierra la sesión y redirige al inicio de sesión.

## Importación de propuestas

`POST /api/v1/sire/import` requiere `multipart/form-data` con los campos `file` (`.txt`, máximo 5 MiB), `period` (`YYYYMM`) y `bookType` (`RVIE_VENTAS` o `RCE_COMPRAS`). `POST /api/v1/sire/proposal/replace` usa los mismos campos para reemplazar la propuesta. El backend autentica al usuario y determina la empresa desde su JWT.

`POST /api/v1/sire/upload` recibe un reporte `.csv` o `.xlsx` de máximo 5 MiB y los campos `period` y `bookType`. El navegador asigna el `Content-Type` multipart con su boundary; el frontend no debe establecerlo manualmente. El frontend valida la extensión y el tamaño y muestra el nombre y peso del archivo antes de enviar.

El parser provisional espera una fila por comprobante, separada por `|`, en este orden:

```text
RUC|tipo|serie|correlativo|fecha (YYYY-MM-DD)|base|IGV|total|CAR
```

La respuesta informa `imported`, `rejected` y `errors` con número de línea y motivo. La interfaz presenta estos totales y errores por fila. No presentar este flujo como compatible con los TXT oficiales de SUNAT hasta verificar e implementar el layout vigente para cada libro.

## Integración

`POST /api/v1/sire/reconcile` requiere `Authorization: Bearer <token>`.

El cuerpo tiene exactamente esta forma:

```json
{
  "period": "YYYYMM",
  "bookType": "RVIE_VENTAS",
  "localRecords": [
    {
      "emitterRuc": "12345678901",
      "documentType": "01",
      "series": "F001",
      "correlative": "00001234",
      "taxableBase": 100.00,
      "igvAmount": 18.00,
      "totalAmount": 118.00
    }
  ]
}
```

No agregar propiedades al contrato ni enviar `companyId`. Los tipos admitidos son `01`, `03`, `07` y `08`. El frontend adapta sus comprobantes al contrato `localRecords` del backend.

La API responde con conteos, `complianceRate` y `discrepancies`; el cliente adapta esos datos al modelo visual y no recalcula la conciliación. El porcentaje y las diferencias siempre provienen del backend.

`POST /api/v1/sire/close` recibe `period` y `bookType`. La interfaz requiere una confirmación explícita antes de cerrar el periodo conciliado. `GET /api/v1/sire/history?page=1&limit=20` lista los cierres de la empresa autenticada y se muestra con paginación.

## Escenarios y presentación

| Escenario | Etiqueta | Color |
| --- | --- | --- |
| `COINCIDENCIA_EXACTA` | Coincidencia exacta | Verde |
| `DIFERENCIA_MONTOS` | Diferencia de montos | Amarillo |
| `OMISION_LOCAL` | Falta en ERP local | Azul |
| `OMISION_SUNAT` | No lo reconoce SUNAT | Naranja |
| `DUPLICADO_LLAVE` | Llave duplicada · acción manual | Rojo |

Solo para `DUPLICADO_LLAVE`, mostrar `duplicateSource` (`LOCAL`, `SIRE` o `AMBOS`). El backend no elige un registro duplicado: advertir que el usuario debe resolverlo manualmente.

Los valores de porcentaje, diferencias y escenarios provienen del backend; el frontend no debe implementar lógica de conciliación ni persistencia adicional.

## Dashboard de conexión y resiliencia

La pantalla de conciliación SIRE obtiene las métricas de `GET /api/v1/sire/dashboard/metrics` y consulta las gráficas
con `GET /api/v1/sire/dashboard/history?start=<ISO>&end=<ISO>&granularity=minute|hour|day&limit=<n>&offset=<n>`.
Ambas solicitudes usan `Authorization: Bearer <token>` y no envían `companyId`.

Las métricas incluyen `state`, `lastStateChange`, `circuitBreakerScope`, `failureRate`, `slowCallRate`,
`bufferedInvoicesCount`, `totalCalls`, `successfulCalls`, `failedCalls`, `totalRetries`,
`recentFailedCalls`, `mttdSeconds`, `mttrSeconds`, `mtbfSeconds` y `activityScope`.
El semáforo es verde para cero fallos recientes, ámbar para uno a cuatro, y rojo para cinco o más o circuito `OPEN`.
Los valores nulos de MTTD, MTTR o MTBF se presentan como “No disponible”.

El endpoint histórico pagina con `limit`, `offset` y `hasMore` y devuelve puntos dentro de `data`, con `timestamp`,
`retries`, `availabilityPercent`, `observedCalls`, `successfulCalls` y `failedCalls`. Una disponibilidad nula
significa que no hubo llamadas observadas en ese intervalo; no se dibuja como cero. Los errores y estados de carga de ambas consultas se presentan sin bloquear el formulario ni
reemplazar el historial de conciliaciones de `GET /api/v1/sire/history`.

No se generan datos simulados en producción. Si el historial no contiene puntos, las gráficas muestran un estado vacío.

## Navegación del módulo

| Ruta | Vista | Disponibilidad |
| --- | --- | --- |
| `/sire/importar` | Importar Propuesta | Importación habilitada solo para el formato interno provisional de nueve columnas; no usar con TXT oficiales SUNAT. |
| `/sire/conciliacion` | Conciliación y Cruce | Conciliación activa mediante el endpoint descrito arriba. |
| `/sire/cierre` | Resumen de Cierre | Presenta las métricas de la última conciliación de la sesión y permite cerrar el periodo con confirmación; la generación de reemplazos sigue deshabilitada. |
| `/sire/historial` | Historial | Consulta periodos cerrados en el backend con paginación. |

La ruta anterior `/sire` redirige a `/sire/conciliacion`. El acceso de SIRE está limitado a `ADMIN`, `CONTADOR`, `AUDITOR` y `ACCOUNTANT`.
