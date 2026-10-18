# Especificación Técnica: Módulo 3 — Gestión Integral de Importaciones e Inventarios (SYNC-SUNAT)

**Responsable Asignado:** Carlos Ahumada Soles (Arquitecto de Software)  
**Módulo:** `src/modules/customs/`  
**Esquema de BD:** `prisma/schema/customs.prisma`  
**Normativa Aplicable:** 
* Ley General de Aduanas (D.L. N° 1053) y Reglamento (D.S. N° 010-2009-EF).
* Procedimiento General de Importación para el Consumo `DESPA-PG.01` (Despacho Anticipado obligatorio > USD 2,000).
* Procedimiento Específico `DESPA-PE.01.08` (Liquidación y Cobranza de Tributos Aduaneros: Cuotas 0010, 0026 y 0027).
* Régimen de Percepciones del IGV a la Importación (Ley N° 28053 y R.S. N° 203-2003/SUNAT).
* Acuerdo de Valoración de la OMC (Decisión 571 CAN / Tabla de Porcentajes Promedio de Seguro - TPPS).
* Norma Internacional de Contabilidad 2 (NIC 2 — Inventarios / Landed Cost).
* Libros Electrónicos SUNAT PLE (Estructuras 12.1 y 13.1 — Tipo de Comprobante 50 DUA/DAM).
* Sistema Integrado de Registros Electrónicos (SIRE RCE Anexo 8.4 — Registro de Compras de Importaciones).

---

## 1. Propósito y Alcance

Permitir a las MYPES importadoras gestionar de manera integral el ciclo de vida del comercio exterior y el control de existencias:
1. **Gestión de Expedientes de Embarque Internacional:** Registro de expedientes comerciales (`EXP-YYYY-XXXXX`), proveedores del exterior, agencias de aduanas acreditadas, documentos de transporte (B/L, AWB) y bitácora de eventos en tiempo real.
2. **Control Previo VUCE y Mercancías Restringidas:** Verificación de subpartidas nacionales (SPN) sujetas a control de entidades reguladoras (DIGESA, DIGEMID, SENASA, SUCAMEC, MTC, PRODUCE) con registro de documentos resolutivos (`DR`, `SUCE`, `NSO`).
3. **Asistente de Registro y Numeración DAM/DUA (Régimen 10):** Registro de declaraciones aduaneras bajo despacho anticipado, urgente o diferido, captura del canal de control asignado (Verde, Naranja, Rojo) y cálculo exacto del Valor CIF aduanero en USD y PEN.
4. **Liquidación Tributaria y Teledespacho Aduanero:** Determinación matemática de Ad-Valorem (0%, 6%, 11%), IGV (16%), IPM (2%), Percepción (3.5%, 5%, 10%) e intereses moratorios (TIM), emitiendo liquidaciones de cobranza SUNAT (0010, 0026, 0027) con Código de Documento Aduanero (CDA) para pago bancario.
5. **Costeo de Adquisición Landed Cost (NIC 2):** Prorrateo bivariado (por valor FOB y por peso/volumen) de los gastos locales de desaduanaje (almacén portuario, vistos buenos, transporte local, comisiones de agente), capitalizando exclusivamente los costos directos al inventario y aislando los créditos fiscales.
6. **Kardex Permanente Valorizado y Cumplimiento Tributario:** Asiento automático de entrada al inventario bajo el método de Promedio Ponderado, con generación de archivos planos para el PLE 12.1/13.1 y SIRE RCE Anexo 8.4.

---

## 2. Reglas Matemáticas y de Negocio Puras (Capa de Dominio)

### 2.1. Regla 1: Determinación de la Base Imponible Aduanera (Valor CIF)
$$\text{Valor CIF (USD)} = \text{Valor FOB (USD)} + \text{Flete Internacional (USD)} + \text{Seguro Internacional (USD)}$$
* **Tratamiento del Seguro:** Si el importador no cuenta con póliza efectiva de seguro, se aplica supletoriamente la **Tabla de Porcentajes Promedio de Seguro (TPPS)** sobre el FOB según el capítulo arancelario (0.75%, 1.25%, 1.50%, 1.75%, 2.00%, etc.):
  $$\text{Seguro Teórico TPPS (USD)} = \text{FOB (USD)} \times \left(\frac{\text{Tasa TPPS}}{100}\right)$$
* Conversión oficial a moneda nacional:
  $$\text{Valor CIF (PEN)} = \text{Valor CIF (USD)} \times \text{Tipo de Cambio Oficial Venta SUNAT}$$

### 2.2. Regla 2: Liquidación de Derechos Arancelarios (Ad-Valorem)
$$\text{Ad-Valorem (PEN)} = \text{Valor CIF (PEN)} \times \left(\frac{\text{Tasa Ad-Valorem}}{100}\right)$$
* Tasas nominales del Arancel de Aduanas del Perú: $0.00\%$, $6.00\%$ u $11.00\%$.

### 2.3. Regla 3: Liquidación de Impuesto General a las Ventas (IGV 16%) e Impuesto de Promoción Municipal (IPM 2%)
$$\text{Base Imponible IGV/IPM} = \text{Valor CIF (PEN)} + \text{Ad-Valorem (PEN)} + \text{ISC (si aplica)}$$
$$\text{IGV (PEN)} = \text{Base Imponible} \times 0.16$$
$$\text{IPM (PEN)} = \text{Base Imponible} \times 0.02$$
$$\text{Total IGV + IPM (PEN)} = \text{Base Imponible} \times 0.18$$

### 2.4. Regla 4: Liquidación del Régimen de Percepciones del IGV (R.S. N° 203-2003/SUNAT)
$$\text{Base de la Percepción (PEN)} = \text{Valor CIF (PEN)} + \text{Tributos de Importación (Ad-Valorem + ISC + IGV + IPM)}$$
$$\text{Percepción del IGV (PEN)} = \text{Base de la Percepción (PEN)} \times \left(\frac{\text{Tasa de Percepción}}{100}\right)$$
* Tasas normadas:
  * **$10.0\%$:** Importador con condición de No Habido, baja de RUC o que no consigne número de RUC.
  * **$5.0\%$:** Primera importación definitiva para el consumo efectuada por el contribuyente.
  * **$3.5\%$:** Importador habitual con RUC activo y habido.

### 2.5. Regla 5: Emisión y Control de Liquidaciones de Cobranza SUNAT
* **Cuota 0010 (Liquidación DAM):** Incluye Ad-Valorem + IGV + IPM + Tasas de despacho.
* **Cuota 0026 (Liquidación de Percepción):** Emitida por separado para el pago de la percepción del IGV.
* **Cuota 0027 (Multas / Recargos):** Aplicable por multas aduaneras o intereses moratorios por pago extemporáneo (TIM mensual de 0.03% diario).
* Cada liquidación genera un **Código de Documento Aduanero (CDA)** de 14 dígitos para cancelación bancaria vía Teledespacho.

### 2.6. Regla 6: Prorrateo de Costos Landed Cost (NIC 2 — Inventarios)
Para cada ítem o serie $i$ dentro de la DAM ($i = 1, \dots, N$):
1. **Factor de Asignación por Valor FOB:**
   $$F_{\text{fob}, i} = \frac{\text{FOB}_i}{\sum_{k=1}^N \text{FOB}_k}$$
2. **Factor de Asignación por Peso Neto:**
   $$F_{\text{peso}, i} = \frac{\text{Peso Neto}_i}{\sum_{k=1}^N \text{Peso Neto}_k}$$
3. **Distribución de Gastos:**
   $$\text{Gastos Valor}_i = \text{Total Gastos al Valor (Comisión Agente, Seguros Locales)} \times F_{\text{fob}, i}$$
   $$\text{Gastos Peso}_i = \text{Total Gastos al Peso (Almacén, Flete Local, Estiba)} \times F_{\text{peso}, i}$$
4. **Costo Unitario Nacionalizado (Landed Cost Unitario):**
   $$\text{Costo Total Adquirido}_i = \text{CIF (PEN)}_i + \text{Ad-Valorem (PEN)}_i + \text{Gastos Valor}_i + \text{Gastos Peso}_i$$
   $$\text{Landed Cost Unitario (PEN)}_i = \frac{\text{Costo Total Adquirido}_i}{\text{Cantidad}_i}$$
* **Exclusión Obligatoria:** El IGV (16%), IPM (2%) y la Percepción (3.5%, 5%, 10%) constituyen **Crédito Fiscal** (Cuentas contables 40111 y 40113) y **jamás se suman al costo del producto** (Cuenta 20111). Las multas aduaneras (Cuota 0027) son gastos del ejercicio (Cuenta 659).

### 2.7. Regla 7: Actualización de Kardex Valorizado (Promedio Ponderado)
$$\text{Nuevo Stock} = \text{Stock Anterior} + \text{Cantidad Ingresada}$$
$$\text{Nuevo Valor Total Inventario} = \text{Valor Total Anterior} + \text{Costo Total Adquirido}$$
$$\text{Nuevo Costo Promedio Unitario} = \frac{\text{Nuevo Valor Total Inventario}}{\text{Nuevo Stock}}$$

---

## 3. Estructura de Directorios del Módulo (`src/modules/customs/`)

```text
src/modules/customs/
├── customsModule.ts                       # Módulo NestJS: controladores, casos de uso, repositorios y eventos
│
├── domain/                                # [CAPA 1: DOMINIO PURO - SIN DEPENDENCIAS DE FRAMEWORKS]
│   ├── entities/
│   │   ├── customsShipmentEntity.ts       # Expediente de embarque internacional
│   │   ├── customsDeclarationEntity.ts    # Declaración Aduanera (DAM / DUA)
│   │   ├── customsItemEntity.ts           # Ítem / Serie de la DUA con SPN y atributos
│   │   ├── customsSettlementEntity.ts     # Liquidación de cobranza SUNAT (0010/0026/0027) con CDA
│   │   ├── landedCostSheetEntity.ts       # Hoja de costeo y prorrateo NIC 2
│   │   └── kardexMovementEntity.ts        # Movimiento de inventario permanente valorizado
│   ├── rules/
│   │   ├── TaxLiquidationEngine.ts        # Motor puro de liquidación de tributos y percepciones
│   │   ├── ProrationEngine.ts             # Motor puro de prorrateo bivariado de Landed Cost (NIC 2)
│   │   └── VuceComplianceEngine.ts        # Validación de subpartidas restringidas y permisos VUCE
│   ├── value-objects/
│   │   ├── duaNumberVo.ts                 # Formato oficial: [Aduana]-[Año]-[Régimen]-[Correlativo 6D]
│   │   ├── hsCodeVo.ts                    # Formato Subpartida Nacional: 10 dígitos numéricos
│   │   └── cdaNumberVo.ts                 # Formato Código Documento Aduanero (CDA) de 14 dígitos
│   └── ports/
│       ├── customsShipmentRepositoryPort.ts
│       ├── customsDeclarationRepositoryPort.ts
│       ├── customsSettlementRepositoryPort.ts
│       ├── landedCostRepositoryPort.ts
│       ├── kardexRepositoryPort.ts
│       └── sunatExchangeRatePort.ts
│
├── application/                           # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   ├── createShipmentDto.ts
│   │   ├── registerDuaWizardDto.ts
│   │   ├── calculateLandedCostDto.ts
│   │   └── registerKardexFromDuaDto.ts
│   └── use-cases/
│       ├── createShipmentUseCase.ts       # Apertura de expediente comercial internacional
│       ├── processVuceCheckUseCase.ts     # Validación previa de mercancía restringida
│       ├── registerDuaWizardUseCase.ts    # Registro completo de DAM, ítems y despacho
│       ├── calculateTaxesUseCase.ts       # Simulación / Liquidación exacta de tributos
│       ├── paySettlementUseCase.ts        # Registro de pago teledespacho bancario de CDA
│       ├── calculateLandedCostUseCase.ts  # Generación de la hoja de costeo y prorrateo NIC 2
│       └── applyLandedCostToKardexUseCase.ts # Impacto definitivo en el inventario Kardex
│
└── infrastructure/                        # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   ├── customsShipmentController.ts   # /api/v1/customs/shipments
    │   ├── customsDeclarationController.ts# /api/v1/customs/declarations
    │   ├── customsSettlementController.ts # /api/v1/customs/settlements
    │   ├── landedCostController.ts        # /api/v1/customs/landed-cost
    │   └── kardexController.ts            # /api/v1/customs/kardex
    ├── constants/
    │   ├── sunatCustomsOffices.ts         # Catálogo en memoria de las 23 aduanas operativas
    │   ├── vuceEntities.ts                # Catálogo en memoria de entidades resolutivas (DIGESA...)
    │   └── customsInsuranceTpps.ts        # Tabla de Porcentajes Promedio de Seguro (TPPS)
    └── persistence/
        ├── prismaCustomsShipmentRepository.ts
        ├── prismaCustomsDeclarationRepository.ts
        ├── prismaCustomsSettlementRepository.ts
        ├── prismaLandedCostRepository.ts
        └── prismaKardexRepository.ts
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Lógica de cálculo arancelario (`TaxLiquidationEngine`), fórmulas de prorrateo (`ProrationEngine`), invariantes de entidades y Value Objects.
* 🚫 **PROHIBICIONES ESTRICTAS:**
  * Importar librerías externas o decoradores de NestJS (`@Injectable`, `@Controller`).
  * Conectarse a base de datos o importar `@prisma/client`.
  * Asignar el IGV, IPM o Percepción como costo de inventario.

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Orquestar flujos de negocio, validar existencia previa de expedientes, coordinar transacciones mediante puertos de repositorio y publicar eventos de dominio.
* 🚫 **PROHIBICIONES ESTRICTAS:**
  * Inyectar directamente `PrismaService` (debe usarse siempre la interfaz del puerto).
  * Realizar llamadas HTTP directas sin pasar por un puerto de pasarela.

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** Controladores REST con autenticación JWT, esquemas de validación de entrada, persistencia con Prisma sobre Supabase y consumo de catálogos estáticos en TypeScript.
* 🚫 **PROHIBICIONES ESTRICTAS:**
  * Modificar o recalcular fórmulas tributarias dentro de los repositorios de Prisma.

### 4.4. Fronteras Modulares y Desacoplamiento (Anti-Acoplamiento)
* **Con Módulo 1 (Facturación):** El Módulo 1 consulta el stock disponible mediante `GET /api/v1/customs/kardex/stock/:itemCode`. Ningún módulo modifica tablas ajenas.
* **Con Módulo 4 (SIRE):** El Módulo 3 expone el endpoint `GET /api/v1/customs/reports/sire-8.4` para generar el archivo TXT estructurado según la R.S. 112-2021/SUNAT.
* **Con Módulo 5 (Contabilidad):** Al liquidarse y pagarse la DAM, se emite el evento `DuaPaidEvent` mediante la tabla Outbox. El módulo contable lo procesa de manera asíncrona para generar los asientos de importación (Cuentas `60111`, `40111`, `40113`, `4212`). Si el módulo contable no está activo, la operación aduanera **no se bloquea**.

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
export const CUSTOMS_SHIPMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SHIPMENT_REPOSITORY_PORT');
export const CUSTOMS_DECLARATION_REPOSITORY_PORT = Symbol('CUSTOMS_DECLARATION_REPOSITORY_PORT');
export const CUSTOMS_SETTLEMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SETTLEMENT_REPOSITORY_PORT');
export const LANDED_COST_REPOSITORY_PORT = Symbol('LANDED_COST_REPOSITORY_PORT');
export const KARDEX_REPOSITORY_PORT = Symbol('KARDEX_REPOSITORY_PORT');
export const SUNAT_EXCHANGE_RATE_PORT = Symbol('SUNAT_EXCHANGE_RATE_PORT');

export interface ICustomsDeclarationRepositoryPort {
  save(declaration: CustomsDeclarationEntity): Promise<CustomsDeclarationEntity>;
  findById(id: string, companyId: string): Promise<CustomsDeclarationEntity | null>;
  findByDuaNumber(duaNumber: string, companyId: string): Promise<CustomsDeclarationEntity | null>;
  list(companyId: string, filters: { year?: number; status?: string }): Promise<CustomsDeclarationEntity[]>;
}

export interface ILandedCostRepositoryPort {
  saveSheet(sheet: LandedCostSheetEntity): Promise<LandedCostSheetEntity>;
  findByDeclarationId(declarationId: string, companyId: string): Promise<LandedCostSheetEntity | null>;
}

export interface IKardexRepositoryPort {
  registerMovement(movement: KardexMovementEntity): Promise<void>;
  getLatestBalance(itemCode: string, companyId: string): Promise<{ stock: number; totalCost: number; averageCost: number }>;
  listMovements(itemCode: string, companyId: string, year: number): Promise<KardexMovementEntity[]>;
}
```

---

## 6. Matriz de Endpoints REST del Módulo

| Método | Endpoint | Descripción | Código Éxito |
| :---: | :--- | :--- | :---: |
| `POST` | `/api/v1/customs/shipments` | Crea nuevo expediente de importación | `201 Created` |
| `GET` | `/api/v1/customs/shipments` | Lista expedientes con filtros de estado | `200 OK` |
| `POST` | `/api/v1/customs/declarations/calculate` | Simulación matemática de tributos DAM (sin guardar) | `200 OK` |
| `POST` | `/api/v1/customs/declarations` | Registra DAM oficial con ítems y genera liquidaciones | `201 Created` |
| `GET` | `/api/v1/customs/declarations/:id` | Detalle completo de la DAM, ítems y liquidaciones | `200 OK` |
| `POST` | `/api/v1/customs/settlements/:id/pay` | Registra el pago bancario de la cuota con CDA | `200 OK` |
| `POST` | `/api/v1/customs/landed-cost/calculate` | Genera y prorratea la hoja de costos Landed Cost | `200 OK` |
| `POST` | `/api/v1/customs/landed-cost/apply-kardex` | Asienta el ingreso a Kardex y actualiza costo promedio | `201 Created` |
| `GET` | `/api/v1/customs/kardex/movements` | Consulta el historial de movimientos de inventario | `200 OK` |
| `GET` | `/api/v1/customs/reports/sire-8.4` | Exporta archivo de texto plano para SIRE RCE | `200 OK` |

---

## 7. Casos de Prueba Requeridos en `test/`

1. **`TaxLiquidationEngine.spec.ts` (Unitario):**
   * Cálculo de CIF con seguro contratado vs seguro teórico TPPS.
   * Conversión a PEN con tipo de cambio oficial venta.
   * Liquidación exacta de Ad-Valorem (0%, 6%, 11%), IGV (16%), IPM (2%).
   * Percepción escalonada (10% sin RUC, 5% primera importación, 3.5% habitual).
   * Cálculo de intereses moratorios aduaneros ante pago extemporáneo.
2. **`ProrationEngine.spec.ts` (Unitario):**
   * Prorrateo multivariable de fletes locales por peso y comisiones de agente por valor FOB.
   * Garantía de que la suma de los costos prorrateados cuadre exactamente al centavo con el costo total incurrido.
   * Verificación de que el IGV y percepciones no se incluyan en el costo unitario de inventario.
3. **`duaNumberVo.spec.ts` (Unitario):**
   * Aceptación de formatos oficiales SUNAT (`118-2026-10-012345`).
   * Rechazo de códigos de aduana inexistentes o años inválidos.
4. **`RegisterDuaWizardUseCase.spec.ts` (Integración):**
   * Orquestación completa: recepción de DTO, cálculo de tributos, generación de liquidaciones 0010 y 0026 y persistencia relacional.
5. **`ApplyLandedCostToKardexUseCase.spec.ts` (Integración):**
   * Asiento de entrada a Kardex, recálculo de stock y costo promedio ponderado.

---

## 8. Buenas Prácticas Innegociables y Definición de Terminado (DoD)

* **Precisión Decimal:** Todos los cálculos monetarios deben usar representación decimal exacta (`DECIMAL(14, 2)` o `DECIMAL(14, 4)` para costos unitarios).
* **Consumo de Memoria:** Catálogos estáticos no deben persistirse en base de datos; residen en TypeScript para preservar los 500 MB de Supabase Free Tier.
* **Aislamiento Multi-Tenant:** Toda consulta y mutación requiere el `company_id` validado desde el JWT.
* **Límite de Líneas:** Ningún archivo debe exceder las 200 líneas de código; modularizar en submódulos atómicos si supera las 150 líneas.
