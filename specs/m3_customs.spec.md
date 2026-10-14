# Especificación Técnica: Módulo 3 — Ingesta Aduanera e Importaciones (DUA/DAM & Kardex)

**Responsable Asignado:** Carlos Ahumada Soles (Arquitecto de Software)  
**Módulo:** `src/modules/customs/`  
**Esquema de BD:** `prisma/schema/customs.prisma`  
**Normativa Aplicable:** Procedimiento Aduanero DESPA-PG.01, R.S. N° 203-2003/SUNAT (Régimen de Percepciones)  

---

## 1. Propósito y Alcance

Permitir a las MYPES importadoras registrar declaraciones aduaneras de mercancías (DUA / DAM formato 10 - Importación para el Consumo), calcular de forma matemática exacta la base imponible aduanera en Dólares (**Valor CIF**), liquidar los tributos de nacionalización en Soles (Ad-Valorem, IGV 16%, IPM 2% y Percepción del IGV) y prorratear los costos de importación para obtener el **Costo Unitario Nacionalizado (Landed Cost)**, impactando el inventario permanente valorizado (**Kardex**) bajo el método de **Promedio Ponderado**.

---

## 2. Reglas Matemáticas y de Negocio Puras (Capa de Dominio)

### 2.1. Regla 1: Cálculo del Valor CIF en Dólares (Casilla 4 de la DAM)
$$\text{Valor CIF (USD)} = \text{FOB (USD)} + \text{Flete Internacional (USD)} + \text{Seguro Internacional (USD)}$$
*Restricción:* Todos los valores deben ser estrictamente positivos y expresados con dos decimales exactos (`DECIMAL(14, 2)`).

### 2.2. Regla 2: Conversión a Moneda Nacional (Soles)
$$\text{CIF (PEN)} = \text{CIF (USD)} \times \text{Tipo de Cambio Oficial Venta SUNAT}$$

### 2.3. Regla 3: Liquidación de Derechos Arancelarios (Ad-Valorem)
$$\text{Ad-Valorem (PEN)} = \text{CIF (PEN)} \times \left(\frac{\text{Tasa Ad-Valorem}}{100}\right)$$
*Tasas permitidas según la subpartida nacional:* $0.00\%$, $6.00\%$ u $11.00\%$.

### 2.4. Regla 4: Liquidación de IGV (16%) e IPM (2%)
$$\text{Base Imponible IGV/IPM} = \text{CIF (PEN)} + \text{Ad-Valorem (PEN)}$$
$$\text{IGV + IPM (PEN)} = \text{Base Imponible IGV/IPM} \times 0.18$$

### 2.5. Regla 5: Liquidación de Percepción del IGV (R.S. 203-2003/SUNAT)
$$\text{Base Percepción (PEN)} = \text{CIF (PEN)} + \text{Ad-Valorem (PEN)} + \text{IGV/IPM (PEN)}$$
$$\text{Percepción (PEN)} = \text{Base Percepción (PEN)} \times \left(\frac{\text{Tasa Percepción}}{100}\right)$$
*Tasas normadas:* $3.5\%$ (importador habitual), $5.0\%$ (primera importación) o $10.0\%$ (sin RUC activo).

### 2.6. Regla 6: Prorrateo de Costos y Costo Unitario Nacionalizado (Landed Cost)
Para cada ítem o serie de la DUA ($i$):
$$\text{Landed Cost Unitario (PEN)}_i = \frac{\text{CIF Prorrateado (PEN)}_i + \text{Ad-Valorem Prorrateado (PEN)}_i}{\text{Cantidad}_i}$$
*Nota Contable Obligatoria:* El IGV/IPM y la Percepción **NO forman parte del costo de inventario** porque constituyen **Crédito Fiscal** deducible para la MYPE.

### 2.7. Regla 7: Actualización de Kardex Valorizado (Promedio Ponderado)
$$\text{Nuevo Stock} = \text{Stock Anterior} + \text{Cantidad Ingresada}$$
$$\text{Nuevo Valor Total} = \text{Valor Total Anterior} + \text{Total Costo Ingreso}$$
$$\text{Nuevo Costo Promedio Unitario} = \frac{\text{Nuevo Valor Total}}{\text{Nuevo Stock}}$$

---

## 3. Estructura de Directorios del Módulo (`src/modules/customs/`)

```text
src/modules/customs/
├── customsModule.ts                  # Módulo NestJS con controladores y proveedores de puertos
│
├── domain/                           # [CAPA 1: DOMINIO PURO]
│   ├── entities/
│   │   ├── customsDeclarationEntity.ts # Entidad de Declaración DUA
│   │   └── kardexMovementEntity.ts    # Entidad de Movimiento de Inventario
│   ├── rules/
│   │   ├── calculateCifRule.ts        # Cálculo puro de Valor CIF en USD y PEN
│   │   └── calculateCustomsTaxesRule.ts # Liquidación pura de Ad-Valorem, IGV y Percepción
│   ├── value-objects/
│   │   └── duaNumberVo.ts             # Validación del formato aduanero oficial (ej. 118-2026-10-012345)
│   └── ports/
│       ├── customsRepositoryPort.ts   # ICustomsRepositoryPort y Symbol CUSTOMS_REPOSITORY_PORT
│       └── kardexRepositoryPort.ts    # IKardexRepositoryPort y Symbol KARDEX_REPOSITORY_PORT
│
├── application/                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   ├── calculateDuaDto.ts         # DTO para cálculo y simulación rápida de aranceles
│   │   └── registerDuaDto.ts          # DTO completo con cabecera e ítems para despacho
│   └── use-cases/
│       ├── calculateDuaUseCase.ts     # Caso de uso: orquesta las reglas de cálculo sin persistir
│       └── registerDuaUseCase.ts      # Caso de uso: valida DUA, liquida tributos y persiste en Kardex
│
└── infrastructure/                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   └── customsController.ts       # Endpoints REST (POST /api/v1/customs/calculate, POST /api/v1/customs/dua)
    ├── parsers/
    │   └── duaXmlParserAdapter.ts     # Adaptador de parseo de archivos Teledespacho SUNAT
    └── persistence/
        ├── prismaCustomsRepository.ts # Adaptador de persistencia DUA en Supabase PostgreSQL
        └── prismaKardexRepository.ts  # Adaptador de persistencia de movimientos Kardex
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Reglas matemáticas de liquidación arancelaria ([calculateCifRule.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/customs/domain/rules/calculateCifRule.ts), [calculateCustomsTaxesRule.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/customs/domain/rules/calculateCustomsTaxesRule.ts)), Value Objects ([duaNumberVo.ts](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/Sistema-gestion-mype-sunat/src/modules/customs/domain/value-objects/duaNumberVo.ts)) e interfaces de puertos.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar decoradores o módulos de NestJS (`@Injectable`, etc.).
  * Importar Prisma o realizar conexiones a base de datos.
  * Mezclar el crédito fiscal del IGV/Percepción dentro del cálculo de costo de mercadería.

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Orquestar el flujo aduanero: recibir el DTO, validar tipos de cambio, invocar las reglas de dominio y delegar a los puertos de repositorio.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Inyectar directamente `PrismaService`.
  * Realizar llamadas HTTP directas a SUNAT sin pasar por un puerto de pasarela o adaptador.

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** Controladores HTTP REST, parseo de XMLs de teledespacho y repositorios Prisma que operan sobre `customs_declarations` y `kardex_movements`.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Alterar los porcentajes de impuestos en las consultas de Prisma (las tasas deben venir validadas por el dominio).

### 4.4. Fronteras Modulares (Anti-Acoplamiento)
* **Prohibido:** Modificar directamente las tablas contables (`accounting_entries`) o de facturación (`invoices`) desde el módulo de aduanas.
* **Integración autorizada:** Al liquidar una DUA, el módulo emite el evento `DuaLiquidatedEvent`. El módulo de contabilidad (`accounting`) escucha este evento para generar automáticamente el asiento contable de importación (Cuentas `60111`, `40111`, `4212`).

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
export const CUSTOMS_REPOSITORY_PORT = Symbol('CUSTOMS_REPOSITORY_PORT');
export const KARDEX_REPOSITORY_PORT = Symbol('KARDEX_REPOSITORY_PORT');

export interface ICustomsRepositoryPort {
  save(declaration: CustomsDeclarationEntity): Promise<CustomsDeclarationEntity>;
  findByDuaNumber(duaNumber: string, companyId: string): Promise<CustomsDeclarationEntity | null>;
}

export interface IKardexRepositoryPort {
  registerMovement(movement: KardexMovementEntity): Promise<void>;
  getLatestBalance(itemCode: string, companyId: string): Promise<{ stock: number; totalCost: number }>;
}
```

---

## 6. Flujo de Implementación Paso a Paso para el Desarrollador (Workflow)

Cuando Carlos deba implementar o extender una funcionalidad de aduanas:

1. **Paso 1 (Reglas de Liquidación):** Escribir la fórmula matemática pura en `domain/rules/`. Crear de inmediato su test unitario en `test/unit/customs/<regla>.spec.ts` validando la exactitud con dos decimales.
2. **Paso 2 (Definir el Puerto):** Declarar las operaciones en `domain/ports/customsRepositoryPort.ts` o `kardexRepositoryPort.ts`.
3. **Paso 3 (Crear el Caso de Uso):** Desarrollar la clase en `application/use-cases/` (ej. `CalculateDuaUseCase`, `RegisterDuaUseCase`) e inyectar el puerto correspondiente.
4. **Paso 4 (Implementar el Repositorio):** Desarrollar la persistencia en `infrastructure/persistence/prismaCustomsRepository.ts` con transacciones ACID locales.
5. **Paso 5 (Controlador y Registro en Módulo):** Exponer el endpoint en `infrastructure/controllers/customsController.ts` y configurar providers en `customsModule.ts`.
6. **Paso 6 (Verificación Integral):**
   ```bash
   npm test -- test/unit/customs
   npm run lint
   npm run build
   ```

---

## 7. Casos de Prueba Requeridos en `test/unit/customs/`

1. **`calculateCifRule.spec.ts`:** Cálculo de CIF en USD y conversión exacta a PEN según tipo de cambio.
2. **`calculateCustomsTaxesRule.spec.ts`:** Liquidación de Ad-Valorem (0, 6 u 11%), IGV/IPM 18% y Percepciones (3.5, 5 o 10%).
3. **`duaNumberVo.spec.ts`:** Formato válido de aduana Callao (`118-2026-10-012345`) y rechazo de códigos inválidos.
4. **`calculateDuaUseCase.spec.ts`:** Orquestación completa de liquidación a partir de un DTO con múltiples ítems.

---

## 8. Buenas Prácticas Innegociables y DoD

* **Límite de líneas:** Archivos concisos (< 150 líneas).
* **Precisión decimal:** Todo cálculo monetario debe redondearse estrictamente a 2 decimales para evitar diferencias de centavos.
* **Aislamiento Multi-Tenant:** `company_id` obligatorio extraído del token JWT para consultas de Kardex y Declaraciones.
