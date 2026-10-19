# Especificación Técnica: Módulo 4 — Conciliación Fiscal SIRE

**Responsable Asignado:** Diego Toledo  
**Módulo:** `src/modules/sire/`  
**Esquema de BD:** `prisma/schema/sire.prisma`  
**Estatus:** 🔒 ESPECIFICACIÓN TÉCNICA VINCULANTE (Spec-Driven Development)

## Normativa y fuentes de referencia

- R.S. N.° 112-2021/SUNAT (RVIE — Libro 140000).
- R.S. N.° 040-2022/SUNAT (RCE — Libro 080000).
- R.S. N.° 000138-2023/SUNAT (referencia de cronograma y disposiciones de implementación SIRE; verificar texto y alcance de cada anexo antes de atribuirle formatos específicos).
- Anexo N.° 2 y anexos aplicables a los archivos de propuesta y reemplazo, según el libro y la versión vigente publicada por SUNAT.

Las referencias a las R.S. N.° 000392-2025/SUNAT y N.° 000125-2026/SUNAT, así como a la R.S.N.A.T.I. N.° 000041-2026-SUNAT/700000, y las fechas de prórroga asociadas deben validarse contra sus publicaciones oficiales antes de usarse para bloquear cierres, definir obligaciones o presentarse como normativa confirmada. El cronograma de obligatoriedad es configurable por contribuyente y no se codifica con fechas fijas en este módulo.

## 1. Contexto de negocio y propósito

El **Sistema Integrado de Registros Electrónicos (SIRE)** permite que SUNAT ponga a disposición de los contribuyentes propuestas mensuales para el **Registro de Ventas e Ingresos Electrónico (RVIE)** y el **Registro de Compras Electrónico (RCE)**. La incorporación y obligatoriedad dependen del cronograma vigente aplicable a cada contribuyente; el módulo no debe asumir que todas las MYPES ni todos los periodos tienen las mismas obligaciones.

El módulo automatiza la auditoría fiscal previa al cierre mensual: importa propuestas descargadas por el contribuyente, las concilia contra datos tipados del sistema local, clasifica diferencias y prepara archivos de reemplazo cuando el usuario lo solicita y el formato oficial aplicable está configurado.

Contingencias relevantes:

1. **Pérdida de crédito fiscal:** compras locales que no aparecen en la propuesta o presentan diferencias.
2. **Omisión de ventas:** comprobantes de la propuesta que no están registrados localmente.
3. **Diferencias de redondeo:** discrepancias monetarias entre el ERP y la propuesta.
4. **Exclusiones en RCE:** un comprobante que estuvo en una propuesta y fue excluido por el contribuyente no debe confundirse con uno que SUNAT nunca propuso. La exclusión debe sustentarse en el historial o estado importado disponible; no se infiere únicamente de la ausencia en la propuesta final.

## 2. Reglas del motor de conciliación

La conciliación se ejecuta por periodo fiscal (`YYYYMM`) y libro (`RVIE` o `RCE`).

### 2.1. Llave compuesta tributaria

La identidad de negocio para el cruce se forma con:

`RUC emisor + tipo de comprobante + serie + correlativo`

Los campos alfanuméricos se normalizan con `trim().toUpperCase()`. Los ceros significativos y el formato de cada campo deben conservarse. La llave no reemplaza la validación de duplicados: si hay más de un registro con la misma llave en cualquiera de las fuentes, el resultado debe señalar el conflicto y no escoger uno silenciosamente.

Tipos iniciales soportados: Factura (`01`), Boleta de Venta (`03`), Nota de Crédito (`07`) y Nota de Débito (`08`). Ampliaciones requieren actualizar el mapeo y sus pruebas.

### 2.2. Tolerancia monetaria

Como regla de conciliación de este sistema, las diferencias absolutas de base imponible e IGV de hasta S/ 0.05, inclusive, se consideran dentro de tolerancia:

`deltaBase = abs(baseLocal - baseSire)`
`deltaIgv = abs(igvLocal - igvSire)`

Los importes deben manejarse con precisión decimal o unidades enteras escaladas; no se deben usar operaciones binarias de punto flotante para decidir límites monetarios. Esta tolerancia es una regla de negocio del módulo y no debe describirse como tolerancia normativa de SUNAT sin una fuente oficial que la establezca.

### 2.3. Escenarios de conciliación

1. **`COINCIDENCIA_EXACTA`:** existe en ambas fuentes y `deltaBase <= 0.05` e `deltaIgv <= 0.05`.
2. **`DIFERENCIA_MONTOS`:** existe en ambas fuentes y `deltaBase > 0.05` o `deltaIgv > 0.05`. Se conservan los importes comparados y las diferencias para revisión.
3. **`OMISION_LOCAL`:** aparece en la propuesta importada y no existe en los datos locales.
4. **`OMISION_SUNAT`:** existe en los datos locales y no aparece en la propuesta importada.

Estos escenarios describen el resultado del cruce. No implican por sí solos aceptación, anotación, exclusión ni envío a SUNAT.

### 2.4. Estado de propuesta y exclusiones de RCE

El estado SIRE se modela por separado del escenario de conciliación. Como mínimo se contemplan `PROPUESTO`, `COMPLEMENTADO`, `EXCLUIDO` y `REEMPLAZADO`, únicamente cuando dicho estado esté respaldado por los datos obtenidos/importados.

`EXCLUIDO_POR_CONTRIBUYENTE` es una clasificación complementaria para un registro que consta como excluido en el historial o estado de RCE. No reemplaza los cuatro escenarios de conciliación ni se interpreta como sinónimo de `OMISION_SUNAT`. `NO_PROPUESTO` describe un comprobante local ausente de la propuesta conocida y, en el cruce, corresponde a `OMISION_SUNAT`.

La persistencia debe conservar el periodo, libro, versión/origen de la propuesta y la información necesaria para distinguir el estado original del estado final. No se debe afirmar que un registro fue excluido si la fuente importada no permite probarlo.

## 3. Identificador CAR

El CAR se conserva como identificador proporcionado por la fuente SIRE y se valida según el formato oficial aplicable al libro y versión importados.

La composición `RUC (11) + tipo (2) + serie (4) + correlativo (10)` suma 27 caracteres y puede usarse como regla de validación solo para los registros cuya especificación oficial confirme esa estructura. No se debe reconstruir ni asumir que ese formato aplica a todos los tipos de registro. El Value Object propuesto es `src/modules/sire/domain/value-objects/carCodeVo.ts`; su validación debe basarse en la estructura oficial vigente y cubrirse con pruebas.

## 4. Importación y exportación de archivos

### 4.1. Importación de propuestas

El módulo importa archivos `.txt` descargados por el contribuyente desde SUNAT. El separador, orden de columnas, codificación y versión del formato deben configurarse de acuerdo con la especificación oficial correspondiente a cada libro y tipo de archivo. No se debe tratar una estructura ilustrativa como un esquema oficial completo.

Adaptador: `src/modules/sire/infrastructure/parsers/sireTxtParserAdapter.ts`. La implementación base usa un esquema provisional de 9 columnas para habilitar el flujo y deja explícito el TODO del Anexo N.° 2; no debe considerarse un parser oficial hasta incorporar el layout verificado por libro.

El parser debe:

- Ignorar líneas vacías y reconocer cabeceras únicamente si el formato oficial las define.
- Validar el número y tipo de columnas requeridas para el formato identificado.
- Interpretar fechas y montos con formatos y precisión explícitos.
- No descartar errores silenciosamente: devolver los registros válidos y un resumen tipado de filas rechazadas con número de línea y motivo, sin incluir datos sensibles innecesarios en logs.
- Rechazar o aislar un archivo cuyo libro, periodo o versión no coincida con los datos de la importación solicitada.

### 4.2. Generación de archivos de reemplazo

La generación de archivos de reemplazo forma parte del alcance funcional, pero cada libro debe usar su propio esquema oficial vigente. RVIE y RCE no deben compartir un formato supuesto. Antes de habilitar la exportación para un libro, se deben documentar y probar con la publicación oficial correspondiente: nombre de archivo, longitud y posiciones, oportunidad, columnas, orden, codificación, terminadores y validaciones.

Adaptador: `src/modules/sire/infrastructure/parsers/sireTxtWriterAdapter.ts`. La implementación base genera un TXT de auditoría marcado `BORRADOR`, no un archivo listo para SUNAT. El writer recibe datos validados y no decide qué comprobantes aceptar, complementar, excluir o reemplazar. La autorización y selección se resuelven antes, en el caso de uso.

La propuesta recibida, el resultado conciliado y el archivo generado deben poder distinguirse y rastrearse por empresa, libro, periodo y versión. No se debe presentar un archivo como listo para envío hasta validar su estructura contra el anexo oficial aplicable.

### 4.3. API de backend

- `POST /api/v1/sire/import`: `multipart/form-data` con `file` (`.txt`, máximo 5 MiB), `period` y `bookType`. Devuelve cantidad importada y filas rechazadas con línea/motivo.
- `POST /api/v1/sire/export`: JSON con `period` y `bookType`; descarga `text/plain`. Mientras el layout del Anexo N.° 3 no esté confirmado, el archivo es solo un borrador de auditoría.
- `GET /api/v1/sire/history?page=1&limit=20`: lista paginada de conciliaciones cerradas con porcentaje y totales por escenario.
- `POST /api/v1/sire/close`: JSON con `period` y `bookType`; cierra la conciliación existente.

Todos los endpoints requieren autenticación. `companyId` se obtiene exclusivamente del JWT y no se acepta como campo del body/query. Un periodo cerrado rechaza nuevas importaciones o conciliaciones.

## 5. Arquitectura y estructura propuesta

```text
src/modules/sire/
├── sireModule.ts
├── domain/
│   ├── entities/
│   │   ├── sireProposalEntity.ts
│   │   └── reconciliationResultEntity.ts
│   ├── rules/
│   │   └── reconciliationMatcherRule.ts
│   ├── value-objects/
│   │   └── carCodeVo.ts
│   └── ports/
│       ├── sireRepositoryPort.ts
│       ├── sireParserPort.ts
│       └── sireExporterPort.ts
├── application/
│   ├── dto/
│   │   ├── reconcilePeriodDto.ts
│   │   ├── reconcileResultDto.ts
│   │   ├── sirePeriodBookDto.ts
│   │   └── sireHistoryQueryDto.ts
│   └── use-cases/
│       ├── reconcileSireUseCase.ts
│       ├── ingestSireProposalUseCase.ts
│       ├── exportSireProposalUseCase.ts
│       ├── getReconciliationHistoryUseCase.ts
│       └── closeFiscalPeriodUseCase.ts
└── infrastructure/
    ├── controllers/
    │   └── sireController.ts
    ├── parsers/
    │   ├── sireTxtParserAdapter.ts
    │   └── sireTxtWriterAdapter.ts
    └── persistence/
        ├── prismaSireRepository.ts
        ├── sirePrismaMappers.ts
        ├── sireReconciliationQueries.ts
        └── sireReconciliationWriter.ts
```

## 6. Fronteras modulares y reglas innegociables

1. **Aislamiento multi-tenant:** toda lectura y escritura se filtra por `companyId` obtenido del contexto autenticado del servidor. El `companyId` enviado por el frontend no es fuente de autoridad.
2. **Sin JOIN cruzado:** el repositorio SIRE no consulta directamente las tablas de facturas. Los comprobantes locales se reciben mediante contratos tipados o servicios exportados.
3. **Tamaño de archivos:** mantener los archivos del módulo en un máximo recomendado de 150 líneas de código; dividir responsabilidades si se supera ese límite.
4. **Dominio puro:** `domain/` no importa `@nestjs/*`, Prisma ni APIs de sistema de archivos como `fs`.
5. **Separación de estado y resultado:** el estado del registro en SIRE y el escenario de conciliación son conceptos distintos y se persisten/modelan separadamente.
6. **Trazabilidad:** las importaciones y exportaciones se asocian a empresa, libro, periodo y versión/origen, sin sobrescribir silenciosamente evidencia previa.

## 7. Pruebas automatizadas

Ubicación propuesta: `test/unit/sire/`.

1. **`reconciliationMatcherRule.spec.ts`:**
   - Coincidencia cuando ambas diferencias son exactamente S/ 0.05.
   - Diferencia cuando base supera S/ 0.05 o IGV supera S/ 0.05.
   - `OMISION_LOCAL` y `OMISION_SUNAT`.
   - Duplicados de llave sin selección silenciosa.
   - Estado excluido respaldado por historial, manteniendo separada la categoría de conciliación.
2. **`carCodeVo.spec.ts`:** formatos válidos e inválidos según el esquema oficial identificado; no asumir universalidad de una composición sin confirmar.
3. **`sireTxtParserAdapter.spec.ts`:** formatos versionados, valores monetarios/fechas, filas incompletas y errores con número de línea y motivo.
4. **`sireTxtWriterAdapter.spec.ts`:** nombre, columnas, codificación y contenido conforme a fixtures/documentación oficial separados por libro y versión.
5. **`reconcileSireUseCase.spec.ts`:** orquestación, persistencia por empresa/libro/periodo y cálculo de métricas.
6. **`sireController.spec.ts`:** periodo `YYYYMM` válido (mes `01`–`12`), contexto autenticado y rechazo de intentos de elegir otro `companyId`.

## 8. Cronograma y obligatoriedad

La obligación SIRE depende del grupo, las disposiciones vigentes y la situación del contribuyente. El sistema debe permitir configurar o consultar esa condición por `companyId` mediante una fuente normativa/administrativa validada, sin codificar una fecha universal en el motor de conciliación.

Las prórrogas y fechas concretas —incluidas las atribuidas a las R.S. N.° 000392-2025/SUNAT y N.° 000125-2026/SUNAT— quedan pendientes de verificación en fuentes oficiales antes de incorporarse a reglas operativas o documentación que las presente como vigentes. La eventual facultad discrecional sancionadora también debe tratarse separadamente de la obligación de llevar los registros y verificarse en su resolución oficial correspondiente.
