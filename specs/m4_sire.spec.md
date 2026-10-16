# Especificación Técnica: Módulo 4 — Conciliación Fiscal SIRE

**Responsable Asignado:** Diego Toledo  
**Módulo:** `src/modules/sire/`  
**Esquema de BD:** `prisma/schema/sire.prisma`  
**Normativa Aplicable:** R.S. N° 112-2021/SUNAT, R.S. N° 040-2022/SUNAT  

---

## 1. Propósito y Alcance

Automatizar la conciliación fiscal mensual del Sistema Integrado de Registros Electrónicos (**SIRE**):
1. Ingesta masiva y parseo de propuestas oficiales de SUNAT para el Registro de Ventas e Ingresos Electrónicos (**RVIE** - Libro 140000) y el Registro de Compras Electrónico (**RCE** - Libro 080000).
2. Cruce automático multidimensional mediante llave compuesta de negocio:
   $$\text{Llave Compuesta} = \text{RUC Emisor} + \text{"-"} + \text{Tipo Comprobante} + \text{"-"} + \text{Serie} + \text{"-"} + \text{Correlativo}$$
3. Detección automática de discrepancias en centavos y clasificación de cada comprobante en los **4 escenarios tributarios normados**.
4. Generación de reportes de auditoría fiscal previa al cierre mensual.

---

## 2. Reglas del Motor de Cruce Multidimensional (Capa de Dominio)

Para cada comprobante analizado en el periodo tributario fiscal:

### 2.1. Escenario 1: `COINCIDENCIA_EXACTA`
El comprobante existe tanto en la contabilidad interna de la MYPE como en la propuesta de SUNAT, y los importes coinciden dentro de una tolerancia de redondeo de $\pm 0.05$ soles:
$$|\text{Base Imponible}_{\text{local}} - \text{Base Imponible}_{\text{sire}}| \le 0.05 \quad \land \quad |\text{IGV}_{\text{local}} - \text{IGV}_{\text{sire}}| \le 0.05$$

### 2.2. Escenario 2: `DIFERENCIA_MONTOS`
El comprobante existe en ambos registros (misma llave compuesta), pero la diferencia en base imponible o IGV supera el umbral de tolerancia ($> 0.05$ soles). Se registran los montos de discrepancia y el porcentaje de desviación.

### 2.3. Escenario 3: `OMISION_LOCAL`
El comprobante figura en la propuesta del SIRE de SUNAT, pero no existe registro contable interno en la MYPE (posible factura de compra olvidada o emitida por un proveedor no registrada).

### 2.4. Escenario 4: `OMISION_SUNAT`
El comprobante fue emitido o recibido por la MYPE localmente, pero SUNAT no lo incluyó en su propuesta oficial mensual (posible comprobante en contingencia, no enviado o rechazado por SUNAT).

---

## 3. Estructura de Directorios del Módulo (`src/modules/sire/`)

```text
src/modules/sire/
├── sireModule.ts                     # Módulo NestJS con inyección de dependencias
│
├── domain/                           # [CAPA 1: DOMINIO PURO]
│   ├── entities/
│   │   ├── sireProposalEntity.ts     # Entidad de propuesta oficial SIRE
│   │   └── reconciliationResultEntity.ts # Entidad con el resultado del cruce y discrepancias
│   ├── rules/
│   │   └── reconciliationMatcherRule.ts # Motor puro de cruce y clasificación en los 4 estados
│   ├── value-objects/
│   │   └── carCodeVo.ts              # Validación de Código de Anotación de Registro (CAR)
│   └── ports/
│       ├── sireRepositoryPort.ts     # ISireRepositoryPort y Symbol SIRE_REPOSITORY_PORT
│       └── sireParserPort.ts         # ISireParserPort para adaptadores de archivos
│
├── application/                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   ├── reconcilePeriodDto.ts     # DTO para solicitar conciliación por periodo (YYYYMM)
│   │   └── reconcileResultDto.ts     # DTO con el resumen de coincidencias y discrepancias
│   └── use-cases/
│       ├── reconcileSireUseCase.ts   # Caso de uso: cruza comprobantes locales vs SIRE
│       └── ingestSireProposalUseCase.ts # Caso de uso: parsea y guarda propuesta oficial
│
└── infrastructure/                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   └── sireController.ts         # Endpoints REST (POST /api/v1/sire/reconcile, POST /api/v1/sire/import)
    ├── parsers/
    │   ├── sireCsvParserAdapter.ts   # Parser de archivos CSV descargados del portal SOL
    │   └── sireTxtParserAdapter.ts   # Parser de archivos planos TXT del SIRE
    └── persistence/
        └── prismaSireRepository.ts   # Adaptador de persistencia en PostgreSQL Supabase
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Lógica pura del motor de conciliación ([reconciliationMatcherRule.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/sire/domain/rules/reconciliationMatcherRule.ts)), validación de llaves compuestas y entidades de discrepancia.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar decoradores de NestJS (`@Injectable`, etc.).
  * Conectar a Prisma o consultar bases de datos.
  * Realizar lectura física de archivos del sistema de archivos (`fs`, `readline`).

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Casos de uso ([reconcileSireUseCase.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/sire/application/use-cases/reconcileSireUseCase.ts)): obtiene comprobantes locales y del SIRE mediante puertos, invoca el matcher de dominio y retorna el reporte consolidado.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Inyectar directamente `PrismaService`.
  * Escribir lógica de cruce dentro del caso de uso (el cruce pertenece exclusivamente a `reconciliationMatcherRule.ts`).

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** Endpoints REST ([sireController.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/sire/infrastructure/controllers/sireController.ts)), adaptadores de parseo de archivos CSV/TXT de SUNAT y repositorios Prisma para tablas `sire_proposals`, `sire_reconciliations` y `sire_discrepancies`.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Mezclar el parseo sintáctico de líneas de texto con las reglas tributarias de conciliación.

### 4.4. Fronteras Modulares (Anti-Acoplamiento)
* **Prohibido:** Hacer `JOIN` SQL o consultas directas a la tabla `invoices` desde el repositorio de `sire`.
* **Mecanismo autorizado:** Solicitar los comprobantes del periodo a través del puerto público o servicio exportado por `invoicesModule.ts`.

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
export const SIRE_REPOSITORY_PORT = Symbol('SIRE_REPOSITORY_PORT');

export interface ISireRepositoryPort {
  saveBatchProposals(proposals: SireProposalEntity[]): Promise<void>;
  findProposalsByPeriod(companyId: string, period: string, bookType: 'RVIE' | 'RCE'): Promise<SireProposalEntity[]>;
  saveReconciliationResult(result: ReconciliationResultEntity): Promise<void>;
}
```

---

## 6. Flujo de Implementación Paso a Paso para el Desarrollador (Workflow)

Cuando Diego deba implementar o extender una funcionalidad en el módulo SIRE:

1. **Paso 1 (Motor de Cruce Puro):** Programar o actualizar la lógica del cruce en `domain/rules/reconciliationMatcherRule.ts`. Escribir su test unitario en `test/unit/sire/reconciliationMatcherRule.spec.ts` probando los 4 escenarios exhaustivamente.
2. **Paso 2 (Definir el Puerto):** Declarar las operaciones necesarias en `domain/ports/sireRepositoryPort.ts`.
3. **Paso 3 (Crear el Caso de Uso):** Desarrollar la orquestación en `application/use-cases/reconcileSireUseCase.ts` inyectando el puerto con `@Inject(SIRE_REPOSITORY_PORT)`. Escribir su test unitario.
4. **Paso 4 (Adaptador de Persistencia / Parser):** Implementar la carga de datos en `infrastructure/persistence/prismaSireRepository.ts`.
5. **Paso 5 (Controlador y Módulo):** Exponer el endpoint en `infrastructure/controllers/sireController.ts` y configurar providers en `sireModule.ts`.
6. **Paso 6 (Verificación Integral):**
   ```bash
   npm test -- test/unit/sire
   npm run lint
   npm run build
   ```

---

## 7. Casos de Prueba Requeridos en `test/unit/sire/`

1. **`reconciliationMatcherRule.spec.ts`:**
   * Detección exacta de `COINCIDENCIA_EXACTA` dentro del rango de $\pm 0.05$ soles.
   * Detección de `DIFERENCIA_MONTOS` cuando la diferencia supera 0.05 soles.
   * Detección de `OMISION_LOCAL` y `OMISION_SUNAT`.
2. **`reconcileSireUseCase.spec.ts`:** Orquestación y cálculo de totales conciliados vs discrepantes.
3. **`sireController.spec.ts`:** Validación de DTO de periodo (`YYYYMM`) y respuesta estructurada HTTP 200.

---

## 8. Buenas Prácticas Innegociables y DoD

* **Límite de líneas:** Archivos concisos (< 150 líneas).
* **Manejo de redondeo centesimal:** Respetar la tolerancia de 0.05 soles normada por SUNAT para evitar falsos positivos en auditoría.
* **Aislamiento Multi-Tenant:** `company_id` obligatorio extraído del token JWT en todas las consultas de propuestas.
