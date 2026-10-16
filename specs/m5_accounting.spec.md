# Especificación Técnica: Módulo 5 — Contabilidad PCGE y Libros PLE

**Responsable Asignado:** Michael Velásquez  
**Módulo:** `src/modules/accounting/`  
**Esquema de BD:** `prisma/schema/accounting.prisma`  
**Normativa Aplicable:** R.S. N° 286-2009/SUNAT (PLE), Plan Contable General Empresarial (PCGE)  

---

## 1. Propósito y Alcance

Automatización de la contabilidad analítica por partida doble para MYPES:
1. Generación automática y validación de asientos contables a partir de eventos del sistema (ventas aceptadas `InvoiceAcceptedEvent` y pólizas aduaneras liquidadas `DuaLiquidatedEvent`).
2. Validación estricta del **Principio de Partida Doble** ($\sum \text{Debe} = \sum \text{Haber}$) a nivel de centavos.
3. Asignación y validación de cuentas maestras del **Plan Contable General Empresarial (PCGE)**.
4. Generación y exportación de archivos planos oficiales para el **Programa de Libros Electrónicos (PLE)** con campos delimitados por tuberías (`|`) y nomenclatura oficial de archivo.

---

## 2. Reglas Matemáticas y de Negocio Puras (Capa de Dominio)

### 2.1. Regla 1: Principio de Partida Doble (Cuadre Centesimal)
$$\sum_{i=1}^{n} \text{Debe}_i = \sum_{j=1}^{m} \text{Haber}_j$$
*Restricción:* Cualquier asiento contable donde la diferencia absoluta entre el Debe y el Haber supere los `0.00` soles debe ser rechazado de forma inmediata lanzando una excepción de dominio (`DoubleEntryMismatchException`).

### 2.2. Regla 2: Dinámica de Cuentas Normalizadas PCGE
* **Asiento de Venta de Mercaderías (Comprobante Aceptado):**
  * Cuenta `1212` (Cuentas por Cobrar Comerciales - Emitidas): **DEBE** por el Monto Total.
  * Cuenta `40111` (Tributos por Pagar - IGV Cuenta Propia): **HABER** por el Monto IGV (18%).
  * Cuenta `70121` (Ventas - Mercaderías Venta Local): **HABER** por la Base Imponible.
* **Asiento de Importación y Nacionalización (DUA Liquidada):**
  * Cuenta `60111` (Compras - Mercaderías): **DEBE** por el Valor CIF + Ad-Valorem.
  * Cuenta `40111` (Tributos por Pagar - IGV Importaciones): **DEBE** por el IGV aduanero y Percepción (Crédito Fiscal).
  * Cuenta `4212` (Cuentas por Pagar Comerciales - Emitidas): **HABER** por el Costo Total a pagar.

### 2.3. Regla 3: Nomenclatura Oficial del Archivo Plano PLE
Estructura fija oficial normada por SUNAT:
$$\text{"LE"} + \text{RUC (11)} + \text{AÑO (4)} + \text{MES (2)} + \text{"00"} + \text{COD\_LIBRO (6)} + \text{"00001111.txt"}$$
* Ejemplo para RUC `20100070970`, Libro Diario (`050100`), Periodo Octubre 2026:
  `LE2010007097020261000050100001111.txt`
* Cada línea debe terminar obligatoriamente con el carácter tubería (`|`) seguido de salto de línea `\r\n`.

---

## 3. Estructura de Directorios del Módulo (`src/modules/accounting/`)

```text
src/modules/accounting/
├── accountingModule.ts               # Módulo NestJS: registra controladores, casos de uso y providers de puertos
│
├── domain/                           # [CAPA 1: DOMINIO PURO]
│   ├── entities/
│   │   ├── accountingEntryEntity.ts  # Entidad inmutable de Asiento Contable y Líneas (Debe/Haber)
│   │   └── pleBookEntity.ts          # Entidad de Libro Electrónico PLE
│   ├── rules/
│   │   ├── doubleEntryRule.ts        # Validación matemática pura de Partida Doble (Debe = Haber)
│   │   └── pleFileNameRule.ts        # Generador y validador de nombre oficial de archivo PLE TXT
│   └── ports/
│       ├── accountingRepositoryPort.ts # IAccountingRepositoryPort y Symbol ACCOUNTING_REPOSITORY_PORT
│       └── pleExporterPort.ts        # IPleExporterPort y Symbol PLE_EXPORTER_PORT
│
├── application/                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   ├── createAccountingEntryDto.ts # DTO de entrada con líneas contables
│   │   └── exportPleDto.ts           # DTO para solicitar la exportación PLE por periodo
│   └── use-cases/
│       ├── generateAccountingEntryUseCase.ts # Caso de uso: crea entidad y valida partida doble
│       └── exportPleTxtUseCase.ts    # Caso de uso: genera contenido delimitado por tuberías |
│
└── infrastructure/                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   └── accountingController.ts   # Endpoints REST (POST /api/v1/accounting/entries, POST /api/v1/accounting/ple/export)
    ├── persistence/
    │   └── prismaAccountingRepository.ts # Adaptador de persistencia en PostgreSQL Supabase
    └── exporters/
        └── pleTxtExporterAdapter.ts  # Adaptador de formateo de texto plano para SUNAT
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Validación de partida doble ([doubleEntryRule.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/domain/rules/doubleEntryRule.ts)), nomenclatura PLE ([pleFileNameRule.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/domain/rules/pleFileNameRule.ts)), entidades ([accountingEntryEntity.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/domain/entities/accountingEntryEntity.ts)) y contratos de puertos.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar decoradores o módulos de NestJS.
  * Importar Prisma o cualquier ORM de base de datos.
  * Permitir asientos con descuadre centesimal.

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Casos de uso ([generateAccountingEntryUseCase.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/application/use-cases/generateAccountingEntryUseCase.ts), [exportPleTxtUseCase.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/application/use-cases/exportPleTxtUseCase.ts)): orquestan la validación, persistencia y exportación.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Inyectar directamente `PrismaService`.
  * Escribir consultas SQL directas.
  * Modificar los cálculos del Debe y Haber en el caso de uso (debe hacerlo `DoubleEntryRule`).

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** Endpoints REST ([accountingController.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/accounting/infrastructure/controllers/accountingController.ts)), adaptadores de persistencia Prisma en tablas `accounting_entries`, `accounting_lines` y `ple_books`.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Almacenar archivos TXT temporales en el disco del contenedor sin limpieza posterior.

### 4.4. Fronteras Modulares (Anti-Acoplamiento)
* **Prohibido:** Que `accounting` consulte directamente las tablas privadas de `invoices` o `customs`.
* **Mecanismo autorizado:** Consumir eventos del Event Bus (`@OnEvent('invoice.accepted')`, `@OnEvent('dua.liquidated')`) para generar asientos automáticamente.

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
// src/modules/accounting/domain/ports/accountingRepositoryPort.ts
export const ACCOUNTING_REPOSITORY_PORT = Symbol('ACCOUNTING_REPOSITORY_PORT');

export interface IAccountingRepositoryPort {
  saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>;
  findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>;
  getNextEntryNumber(companyId: string, period: string): Promise<number>;
}

// src/modules/accounting/domain/ports/pleExporterPort.ts
export const PLE_EXPORTER_PORT = Symbol('PLE_EXPORTER_PORT');

export interface IPleExporterPort {
  generatePleTxt(entries: AccountingEntryEntity[], bookCode: string): Promise<string>;
}
```

---

## 6. Flujo de Implementación Paso a Paso para el Desarrollador (Workflow)

Cuando Michael deba implementar o extender una funcionalidad contable:

1. **Paso 1 (Regla Contable Pura):** Programar la validación o regla en `domain/rules/doubleEntryRule.ts`. Escribir su test unitario en `test/unit/accounting/doubleEntryRule.spec.ts` validando el rechazo de descuadres.
2. **Paso 2 (Definir el Puerto):** Declarar las firmas abstractas en `domain/ports/accountingRepositoryPort.ts`.
3. **Paso 3 (Crear el Caso de Uso):** Desarrollar la clase en `application/use-cases/` e inyectar el puerto correspondiente.
4. **Paso 4 (Implementar el Repositorio):** Desarrollar la persistencia en `infrastructure/persistence/prismaAccountingRepository.ts`.
5. **Paso 5 (Controlador y Registro en Módulo):** Exponer el endpoint en `infrastructure/controllers/accountingController.ts` y configurar providers en `accountingModule.ts`.
6. **Paso 6 (Verificación Integral):**
   ```bash
   npm test -- test/unit/accounting
   npm run lint
   npm run build
   ```

---

## 7. Casos de Prueba Requeridos en `test/unit/accounting/`

1. **`doubleEntryRule.spec.ts`:** Cuadre de partida doble y excepción inmediata ante descuadre de centavos.
2. **`pleFileNameRule.spec.ts`:** Generación exacta de la cadena oficial de nombre de archivo PLE para diferentes periodos y libros.
3. **`generateAccountingEntryUseCase.spec.ts`:** Creación de la entidad y validación de balance.
4. **`exportPleTxtUseCase.spec.ts`:** Generación de contenido con campos delimitados por tuberías (`|`).
5. **`accountingController.spec.ts`:** Endpoints REST HTTP 201 y 200 con DTOs validados.

---

## 8. Buenas Prácticas Innegociables y DoD

* **Límite de líneas:** Archivos concisos (< 150 líneas).
* **Partida Doble Innegociable:** Cero tolerancia al descuadre contable ($\text{Debe} - \text{Haber} = 0.00$).
* **Aislamiento Multi-Tenant:** `company_id` obligatorio obtenido del token JWT en todas las consultas y reportes contables.
