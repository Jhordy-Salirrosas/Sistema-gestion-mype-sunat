# PLAN MAESTRO DE INGENIERÍA Y TRABAJO TÉCNICO (SYNC-SUNAT)

**Proyecto:** SYNC-SUNAT — Sistema de Gestión MYPE & Integración Tributaria SUNAT  
**Autor y Arquitecto:** Carlos Ahumada Soles  
**Destinatarios:** Equipo de Desarrollo (Carlos, Jhordy, Oliver, Michael, Diego) y Asistente Operativo / IA (OA)  
**Versión:** 1.0.0 — Octubre 2026  
**Estatus:** 🔒 NORMATIVA INNEGOCIABLE DEL REPOSITORIO

---

## 1. Declaración de Principios y Marco de Trabajo

Este documento establece el **70% de las directrices operativas, arquitectónicas y de codificación** que rigen la construcción del proyecto. Es la **fuente de verdad suprema** tanto para los desarrolladores del equipo como para cualquier Operador Asistente de IA (OA).

### 1.1. Filosofía de Ingeniería

1. **Las buenas prácticas son innegociables:** No se aceptan atajos técnicos, deuda técnica consciente ni "código temporal".
2. **Spec-Driven Development (SDD):** Ninguna línea de código de producción o prueba automatizada se crea sin que exista una especificación previa en `specs/`.
3. **Simetría y Orden Absoluto:** Todo componente del sistema tiene una ubicación unívoca y una nomenclatura estricta. Si un archivo no encaja en la estructura definida, el diseño debe ser revisado.
4. **Límite de Líneas por Archivo (Clean Code):** Ningún archivo de código de producción o prueba debe superar las **150 a 200 líneas**. El tamaño promedio ideal de una clase, regla o caso de uso es de **40 a 90 líneas**.

---

## 2. Arquitectura Global: Monolito Modular Hexagonal (DDD Ligero)

El sistema se estructura como un **Monolito Modular** con **Arquitectura Hexagonal (Ports and Adapters)** y límites de contexto (_Bounded Contexts_) estrictos.

```text
               ┌────────────────────────────────────────────────────────┐
               │                  CAPA DE INFRAESTRUCTURA               │
               │  (Controladores REST, Adaptadores Prisma, Clientes)    │
               │  ┌──────────────────────────────────────────────────┐  │
               │  │               CAPA DE APLICACIÓN                 │  │
               │  │  (Casos de Uso, DTOs, Mappers, Eventos)          │  │
               │  │  ┌────────────────────────────────────────────┐  │  │
               │  │  │              CAPA DE DOMINIO               │  │  │
               │  │  │  (Entidades, Value Objects, Reglas Puras,  │  │  │
               │  │  │   Puertos / Interfaces Abstractas)         │  │  │
               │  │  └────────────────────────────────────────────┘  │  │
               │  └──────────────────────────────────────────────────┘  │
               └────────────────────────────────────────────────────────┘
```

### 2.1. Reglas de Dependencia entre Capas

1. **El Dominio es Agnóstico y Sagrado:**
   - La carpeta `domain/` **NO PUEDE IMPORTAR NADA** de NestJS (`@Injectable`, `@Controller`, etc.), NADA de Prisma (`PrismaClient`, `@prisma/client`), ni de ninguna librería de base de datos o HTTP.
   - Solo contiene TypeScript puro, tipos primitivos, matemáticas y lógica de negocio.
2. **La Aplicación solo Conoce al Dominio:**
   - La carpeta `application/` coordina casos de uso. Puede interactuar con los **Puertos (interfaces)** del dominio, pero nunca directamente con implementaciones de base de datos.
3. **La Infraestructura Implementa los Puertos:**
   - La carpeta `infrastructure/` implementa los repositorios de Prisma, los controladores HTTP de NestJS y los clientes SOAP/REST externos.
4. **Aislamiento entre Módulos:**
   - Un módulo funcional (`invoices`, `customs`, `sire`, `accounting`, `resilience`) **NUNCA debe consultar directamente las tablas ni importar servicios internos de otro módulo**.
   - La comunicación inter-modular se realiza exclusivamente mediante:
     - Eventos de Dominio (`events`).
     - DTOs expuestos públicamente.
     - Servicios de integración autorizados en `common/`.

---

## 3. Mapa Detallado Carpeta por Carpeta y Subcarpeta

Cada carpeta del repositorio tiene una responsabilidad única y reglas estrictas de contenido:

```text
Sistema-gestion-mype-sunat/
├── prisma/                             # ÚNICA carpeta Prisma del proyecto (Base de Datos)
│   ├── schema/                         # Esquemas particionados por Bounded Context (Multi-file)
│   │   ├── base.prisma                 # Configuración del datasource PostgreSQL y generador
│   │   ├── auth.prisma                 # Entidades: Company, User, RefreshToken
│   │   ├── invoicing.prisma            # Entidades: Invoice, InvoiceItem, InvoiceSeries
│   │   ├── resilience.prisma           # Entidades: TransactionHistory, AuditLog
│   │   ├── customs.prisma              # Entidades: CustomsDeclaration, CustomsItem, KardexMovement
│   │   ├── sire.prisma                 # Entidades: SireProposal, SireReconciliation, SireDiscrepancy
│   │   └── accounting.prisma           # Entidades: AccountingEntry, AccountingLine, PleBook
│   ├── migrations/                     # Migraciones versionadas en SQL puro
│   └── seeds/                          # Scripts de precarga de catálogos SUNAT y PCGE
|   └── README.md                       # Modelo de datos: diagrama ER y guía de migraciones
│
├── src/                                # Código fuente de la aplicación (Producción)
│   ├── main.ts                         # Bootstrap de NestJS, Helmet, CORS, Pipes globales
│   ├── appModule.ts                    # Orquestador raíz que importa los módulos funcionales
│   │
│   ├── common/                         # Componentes transversales compartidos
│   │   ├── decorators/                 # @CurrentCompany(), @CurrentUser(), @Roles()
│   │   ├── filters/                    # HttpExceptionFilter (RFC 7807 Problem Details)
│   │   ├── guards/                     # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/               # LoggingInterceptor, ResilienceMetricsInterceptor
│   │   ├── pipes/                      # ValidationPipe global y sanitizadores
│   │   └── health/                     # HealthController y healthModule (Liveness & Readiness probes)
│   │
│   ├── config/                         # Configuración centralizada y Fail-Fast
│   │   └── env.validation.ts           # Validación obligatoria de variables (.env) al arrancar
│   │
│   ├── database/                       # Capa base de conexión a datos
│   │   ├── prismaModule.ts             # Módulo global de persistencia
│   │   └── prismaService.ts            # Extiende PrismaClient con adaptador PostgreSQL (@prisma/adapter-pg)
│   │
│   ├── generated/                      # Código autogenerado por compiladores (IGNORADO EN GIT)
│   │   └── client/                     # Salida de Prisma 7 Client (enums, models, client)
│   │
│   └── modules/                        # Módulos funcionales (Bounded Contexts)
│       ├── auth/                       # Autenticación, JWT, Hashing y Roles
│       ├── invoices/                   # [M1: Facturación UBL 2.1] (Jhordy Salirrosas)
│       ├── resilience/                 # [M2: Resiliencia y Outbox] (Oliver Saldaña)
│       ├── customs/                    # [M3: Aduanas y Kardex] (Carlos Ahumada)
│       ├── sire/                       # [M4: Conciliación SIRE] (Diego Toledo)
│       ├── accounting/                 # [M5: Contabilidad y PLE] (Michael Velásquez)
│       └── sunat/                      # Servicios criptográficos, SOAP y parseo de CDR
│
├── test/                               # TODAS las pruebas del proyecto (CERO tests en src/)
│   ├── unit/                           # Pruebas Unitarias espejo (Mirror Directory Pattern)
│   │   ├── accounting/                 # Pruebas de reglas contables y exportador PLE
│   │   ├── auth/                       # Pruebas de value objects y hashing de auth
│   │   ├── common/                     # Pruebas de componentes transversales
│   │   ├── config/                     # Pruebas de validación de entorno
│   │   ├── customs/                    # Pruebas de cálculo CIF y aranceles
│   │   ├── database/                   # Pruebas del servicio Prisma
│   │   ├── invoices/                   # Pruebas de validación de comprobantes
│   │   ├── resilience/                 # Pruebas de circuitos y reintentos
│   │   ├── sire/                       # Pruebas de conciliación de propuestas
│   │   └── sunat/                      # Pruebas de firma digital y parseo de CDR
│   ├── integration/                    # Pruebas de integración inter-servicios y mock SOAP
│   ├── e2e/                            # Pruebas End-to-End completas (HTTP -> DB)
│   ├── chaos/                          # Pruebas de resiliencia y caos (MTTD, MTTR)
│   ├── mocks/                          # Servidores simulados (Mock billService de SUNAT)
│   ├── fixtures/                       # Archivos muestra (XMLs válidos, DUAs, Certificados PFX)
│   ├── jest-e2e.json                   # Configuración para pruebas E2E
│   └── setup.ts                        # Variables de entorno y bootstrap para tests
│
└── specs/                              # Especificaciones de ingeniería (Spec-Driven Development)
    ├── PLAN.md                         # Este documento normativo maestro
    ├── README.md                       # Guía del ciclo de desarrollo SDD
    ├── global_architecture.spec.md     # SLAs, aislamiento Multi-Tenant y métricas globales
    ├── m1_invoices.spec.md             # Especificación técnica del Módulo de Facturación
    ├── m2_resilience.spec.md           # Especificación técnica de Resiliencia y Outbox
    ├── m3_customs.spec.md             # Especificación técnica de Aduanas y Kardex
    ├── m4_sire.spec.md                 # Especificación técnica de Conciliación SIRE
    └── m5_accounting.spec.md           # Especificación técnica de Contabilidad y PLE
```

---

## 4. Estructura Interna de Cada Módulo (`src/modules/<modulo>/`)

Cada módulo funcional dentro de `src/modules/` debe replicar de manera idéntica las tres capas hexagonales:

```text
src/modules/<modulo>/
├── <modulo>Module.ts                   # Módulo de NestJS en CamelCase (registra proveedores y controladores)
├── domain/                             # [CAPA 1: DOMINIO PURO]
│   ├── entities/                       # Clases de negocio con invariantes y métodos ricos
│   ├── value-objects/                  # Objetos de valor inmutables (validación en constructor)
│   ├── rules/                          # Algoritmos y cálculos puros (sin efectos secundarios)
│   ├── events/                         # Eventos de dominio inmutables (<Entidad><Accion>Event)
│   └── ports/                          # Interfaces abstractas (I<Entidad>RepositoryPort, IGatewayPort)
│
├── application/                        # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── use-cases/                      # Clases individuales <Accion><Entidad>UseCase (< 100 líneas)
│   ├── services/                       # Servicios de aplicación y orquestación (<modulo>Service.ts)
│   ├── mappers/                        # Transformadores de datos DTO <-> Entidad <-> Persistencia
│   └── dto/                            # Data Transfer Objects con decoradores de class-validator
│
└── infrastructure/                     # [CAPA 3: ADAPTADORES TÉCNICOS]
    ├── controllers/                    # Endpoints REST de NestJS (<modulo>Controller.ts)
    ├── persistence/                    # Repositorios Prisma que implementan los puertos del dominio
    └── gateways/ o adapters/           # Clientes HTTP, adaptadores criptográficos o colas
```

---

## 5. Estándares de Nomenclatura y Codificación

### 5.1. Nombres de Archivos

- **Archivos y Componentes del Sistema (100% CamelCase):** Todos los archivos de código siguen la convención `camelCase.ts` sin excepción:
  - Módulos: `appModule.ts`, `invoicesModule.ts`, `sunatModule.ts`, `authModule.ts`, `customsModule.ts`, `sireModule.ts`, `resilienceModule.ts`, `accountingModule.ts`, `prismaModule.ts`, `healthModule.ts`.
  - Controladores: `invoicesController.ts`, `authController.ts`, `sireController.ts`, `accountingController.ts`.
  - Servicios y Casos de Uso: `invoicesService.ts`, `prismaService.ts`, `createInvoiceUseCase.ts`, `loginUseCase.ts`.
  - DTOs y Value Objects: `createInvoiceDto.ts`, `rucVo.ts`, `duaNumberVo.ts`.
  - Reglas de Negocio: `doubleEntryRule.ts`, `calculateCifRule.ts`, `pleFileNameRule.ts`.
- **Pruebas unitarias:** `<nombre-del-archivo-origen>.spec.ts`  
  _Ejemplo:_ `invoices.service.spec.ts`, `doubleEntryRule.spec.ts`.
- **Pruebas E2E:** `<flujo>.e2e-spec.ts`.
- **Interfaces de Puertos:** `I<Entidad><Rol>Port.ts`  
  _Ejemplo:_ `IInvoiceRepositoryPort.ts`, `ISunatGatewayPort.ts`.

### 5.2. Nombres de Código en TypeScript

- **Clases, Módulos, Interfaces, Enums:** `PascalCase` (`CreateInvoiceDto`, `InvoiceEntity`, `InvoiceStatus`).
- **Interfaces de Dominio (Puertos):** Prefijo `I` obligatorio (`IInvoiceRepositoryPort`).
- **Value Objects:** Sufijo `VO` obligatorio (`RucVO`, `DuaNumberVO`, `MontoDecimalVO`).
- **Reglas de Negocio:** Sufijo `Rule` obligatorio (`DoubleEntryRule`, `CalculateCifRule`).
- **Casos de Uso:** Formato `<Verbo><Entidad>UseCase` (`CreateInvoiceUseCase`, `CalculateDuaUseCase`).
- **Métodos y Funciones:** `camelCase` (`execute()`, `calculateTax()`, `validateFormat()`).
- **Constantes Globales y Valores de Enum:** `UPPER_SNAKE_CASE` (`MAX_RETRY_ATTEMPTS`, `FACTURA_ELECTRONICA`).
- **Modelos y Columnas en Base de Datos (Prisma):** `snake_case` mapeados con `@@map("nombre_tabla")` y `@map("nombre_columna")`.

---

## 6. Buenas Prácticas Innegociables

### 6.1. Prohibido Colocar Pruebas en `src/`

- **Regla estricta:** Ningún archivo que termine en `.spec.ts` o `.test.ts` puede residir en `src/`.
- Todas las pruebas pertenecen exclusivamente a la carpeta `test/` bajo su correspondiente subcarpeta (`test/unit/`, `test/integration/`, `test/e2e/`, `test/chaos/`).
- Esta regla previene contaminación del paquete de producción compilado (`dist/`).

### 6.2. Única Carpeta `prisma/` en la Raíz

- En la raíz del repositorio reside `prisma/` con sus esquemas, migraciones y semillas.
- La salida del cliente generado por Prisma 7 se configura obligatoriamente como:
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../../src/generated/client"
  }
  ```
- La carpeta `src/generated/` está listada en `.gitignore`. **Nunca debe existir otra subcarpeta llamada `prisma` dentro de `src/`**.

### 6.3. Aislamiento Multi-Tenant Obligatorio (Anti-IDOR)

- En un sistema MYPE, el aislamiento entre empresas es crítico.
- **Prohibido:** Recibir `company_id` o `companyId` como parámetro de URL (`/invoices/:companyId`) o en el cuerpo de peticiones abiertas.
- **Obligatorio:** El `company_id` debe obtenerse **exclusivamente del token JWT verificado** a través del decorador personalizado `@CurrentCompany()`. Toda consulta y escritura a la base de datos debe filtrar estrictamente por dicho `company_id`.

### 6.4. Validación Fail-Fast al Arranque

- Si falta una variable de entorno crítica (`DATABASE_URL`, `JWT_SECRET`, `SUNAT_SOL_PASS`, etc.), la aplicación **no debe arrancar**.
- Toda variable se valida en [src/config/env.validation.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/config/env.validation.ts) mediante `class-validator` antes de levantar cualquier conexión.

### 6.5. Cero Uso de `any`

- Está estrictamente prohibido usar el tipo `any` en TypeScript.
- Utiliza tipos genéricos, uniones discriminadas, interfaces formales o `unknown` con guardas de tipo (_type narrowing_).

### 6.6. Manejo de Errores con Formato RFC 7807 (Problem Details)

- Todos los errores HTTP devueltos por la API deben seguir la estructura estándar RFC 7807:
  ```json
  {
    "type": "https://sync-sunat.pe/errors/invalid-ruc",
    "title": "RUC del receptor inválido",
    "status": 400,
    "detail": "El dígito verificador calculado por Módulo 11 no coincide con el RUC suministrado.",
    "instance": "/api/v1/invoices"
  }
  ```

---

## 7. Protocolo de Trabajo para el Operador Asistente de IA (OA)

Cuando el desarrollador trabaje asistido por un Operador de Inteligencia Artificial (OA), el asistente **debe obedecer las siguientes directrices sin excepción**:

1. **No Alucinar ni Adelantarse con Código Prematuro:**  
   Si una tarea solicita crear la estructura o scaffolding de un módulo (por ejemplo, el módulo `accounting`), el OA debe crear **únicamente los directorios, interfaces base y esqueletos vacíos**. No debe escribir lógica de negocio ficticia ni adelantarse al trabajo del equipo estudiantil.
2. **Consultar y Respetar la Especificación (`specs/`):**  
   Antes de generar código de un módulo, el OA debe leer la especificación correspondiente (`m1_invoices.spec.md`, `m3_customs.spec.md`, etc.). Cualquier divergencia con la especificación es considerada un defecto grave.
3. **No Eliminar Archivos de Producción Arbitrariamente:**  
   El OA jamás debe borrar módulos existentes de producción (por ejemplo, `src/modules/sunat/` o `src/modules/accounting/`) sin confirmación explícita del desarrollador.
4. **Verificación Continua:**  
   Al concluir cualquier modificación, el OA debe garantizar que:
   - `npm run build` compile limpiamente (código 0).
   - `npm run lint` reporte 0 errores y 0 advertencias.
   - `npm test` pase todas las pruebas existentes al 100% (cero fallos).
5. **Rutas de Importación en Pruebas:**  
   Al crear pruebas dentro de `test/unit/<modulo>/`, el OA debe utilizar rutas relativas de 3 niveles hacia `src/`:
   ```typescript
   import { MyUseCase } from '../../../src/modules/<modulo>/application/use-cases/myUseCase';
   import { InvoiceStatus } from '../../../src/generated/client/enums';
   ```

---

## 8. Flujo de Trabajo en Git y Ciclo de Desarrollo

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. SPEC     │ ──> │  2. TEST     │ ──> │  3. CODE     │ ──> │  4. REVIEW   │
│  (specs/)    │     │  (test/unit) │     │  (src/)      │     │  (Lint/Build)│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Paso 1: Lectura de la Especificación (`specs/`):**  
   Comprender las invariantes, fórmulas matemáticas y puertos requeridos.
2. **Paso 2: Creación de la Prueba en `test/unit/` (TDD / BDD):**  
   Escribir las pruebas unitarias que describan el comportamiento esperado del caso de uso o regla.
3. **Paso 3: Implementación en `src/modules/`:**  
   Escribir el código mínimo y limpio necesario para hacer pasar la prueba, respetando el límite de 150 líneas.
4. **Paso 4: Verificación Integral:**  
   Ejecutar localmente:
   ```bash
   npm test -- test/unit/<tu-modulo>
   npm run lint
   npm run build
   ```
5. **Paso 5: Commits Convencionales (Conventional Commits):**  
   Formato obligatorio:
   - `feat(modulo): descripción clara de la nueva funcionalidad`
   - `fix(modulo): corrección de un bug o cálculo matemático`
   - `test(modulo): adición o actualización de pruebas unitarias`
   - `docs(specs): actualización de diagramas o especificaciones técnicas`
   - `refactor(modulo): mejora estructural sin cambiar el comportamiento externo`

---

## 9. Matriz de Módulos y Responsables del Proyecto

| Bounded Context                    | Responsable Asignado | Módulo en `src/`          | Módulo en `test/`       | Archivo de Especificación                                            |
| :--------------------------------- | :------------------- | :------------------------ | :---------------------- | :------------------------------------------------------------------- |
| **M1: Facturación UBL 2.1**        | Jhordy Salirrosas    | `src/modules/invoices/`   | `test/unit/invoices/`   | [`specs/m1_invoices.spec.md`](./m1_invoices.spec.md)                 |
| **M2: Resiliencia y Outbox**       | Oliver Saldaña       | `src/modules/resilience/` | `test/unit/resilience/` | [`specs/m2_resilience.spec.md`](./m2_resilience.spec.md)             |
| **M3: Aduanas y Kardex**           | Carlos Ahumada       | `src/modules/customs/`    | `test/unit/customs/`    | [`specs/m3_customs.spec.md`](./m3_customs.spec.md)                   |
| **M4: Conciliación SIRE**          | Diego Toledo         | `src/modules/sire/`       | `test/unit/sire/`       | [`specs/m4_sire.spec.md`](./m4_sire.spec.md)                         |
| **M5: Contabilidad y PLE**         | Michael Velásquez    | `src/modules/accounting/` | `test/unit/accounting/` | [`specs/m5_accounting.spec.md`](./m5_accounting.spec.md)             |
| **Transversal: SUNAT Cripto/SOAP** | Carlos Ahumada       | `src/modules/sunat/`      | `test/unit/sunat/`      | [`specs/pipeline_emision.md`](./pipeline_emision.md)                 |
| **Transversal: Seguridad & Auth**  | Carlos Ahumada       | `src/modules/auth/`       | `test/unit/auth/`       | [`specs/global_architecture.spec.md`](./global_architecture.spec.md) |

---

## 10. Lista de Verificación de Calidad (Definition of Done - DoD)

Una tarea o historia de usuario solo se considera **TERMINADA** si cumple todos los puntos siguientes:

- [ ] La especificación en `specs/` está redactada o actualizada.
- [ ] Todas las pruebas unitarias residen en `test/unit/<modulo>/` (ninguna en `src/`).
- [ ] No se utiliza `any` en ninguna parte del código TypeScript nuevo.
- [ ] Todos los archivos cumplen con el límite estricto de menos de 150 a 200 líneas.
- [ ] El caso de uso o mutación respeta el aislamiento por `company_id` verificado.
- [ ] `npm test` aprueba el 100% de las suites de prueba sin errores.
- [ ] `npm run lint` reporta 0 errores y 0 advertencias.
- [ ] `npm run build` compila limpiamente sin fallos de TypeScript.
