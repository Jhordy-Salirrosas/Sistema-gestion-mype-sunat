# Especificación Técnica: Módulo de Importaciones (`customs`) — SYNC-SUNAT
**Sistema de Gestión MYPE - SUNAT**  
**Versión:** 2.0 (Reestructurada, Desacoplada y Alineada a SUNAT)  
**Fecha:** Octubre 2026  
**Responsable Asignado:** Carlos Ahumada Soles (Arquitecto de Software)  
**Módulo:** `src/modules/customs/`  
**Esquema de BD:** `prisma/schema/customs.prisma`  
**Documentos de Referencia:** `docs/reestructuracionImportaciones.md` | `docs/frontedImportacionYkardex.md`

---

## 1. Marco Normativo Aplicable

1. **Ley General de Aduanas (D.L. N° 1053)** y su Reglamento (**D.S. N° 010-2009-EF**).
2. **Procedimiento General de Despacho `DESPA-PG.01`:** Importación para el Consumo (Régimen 10), con obligatoriedad de Despacho Anticipado para valores FOB > USD 2,000.
3. **Procedimiento Específico `DESPA-PE.01.08`:** Liquidación y Cobranza de Tributos Aduaneros (Cuotas 0010, 0026 y 0027).
4. **Acuerdo de Valoración de la OMC (Decisión 571 de la Comunidad Andina):** Formatos A, B (Declaración del Valor) y C de la DAM; aplicación supletoria de la Tabla de Porcentajes Promedio de Seguro (TPPS).
5. **Régimen de Percepciones del IGV a la Importación:** Ley N° 28053, R.S. N° 203-2003/SUNAT y modificaciones vigentes (D.Leg. 1714 / D.S. 104-2026-EF).
6. **Esquema de Tributación Aduanera Vigente:** Desglose exacto de Ad-Valorem (0%, 6%, 11%), IGV (15.5%), IPM (2.5%), Percepción (3.5%, 5.0%, 10.0%) e ISC/Antidumping según la Subpartida Nacional (SPN).
7. **Control VUCE y Mercancías Restringidas:** Regulaciones MTC, DIGESA, DIGEMID, SUCAMEC, SENASA y PRODUCE; control de equipos móviles según R.S. 0129-2026.
8. **Norma Internacional de Contabilidad 2 (NIC 2 — Inventarios):** Determinación del Costo de Adquisición puesto en almacén (*Landed Cost*), prorrateo multivariable y exclusión estricta de tributos recuperables.
9. **R.S. N° 000112-2021/SUNAT (SIRE RCE):** Registro de Compras Electrónico — Estructura y conciliación de Compras de Importación (Tipo de Comprobante 50 DAM).

---

## 2. Propósito y Límites de Dominio (Desacoplamiento Arquitectónico)

### 2.1. Alcance de Responsabilidad de `customs`:
El Módulo de Importaciones administra con rigor legal, documental y financiero el ciclo integral del comercio exterior de la MYPE:
1. **Expedientes de Embarque Internacional:** Órdenes de compra exterior, relación `1 a N` con DAMs, proveedores del exterior, transporte (B/L, AWB, Carta Porte) y bitácora de tracking logístico.
2. **Control VUCE y Mercancías Restringidas:** Verificación de subpartidas restringidas y registro de resoluciones autorizantes.
3. **Declaración Aduanera de Mercancías (DAM):** Asistente estructurado para Formatos A (Series/Ítems), B (Valoración/Cuestionario OMC casillas 7 y 8) y C (Liquidación de tributos).
4. **Tributos, CDAs y Pagos Aduaneros:** Liquidaciones oficiales de aduanas, captura de CDAs oficiales de SUNAT (18 dígitos), registro de constancias de pago bancario y aplicación de garantías previas (Art. 160 LGA).
5. **Recepción Física de Mercancías (`GoodsReceipt`):** Acta de descarga en almacén, apertura de contenedor, verificación de precintos, conteo físico y registro de diferencias (sobrantes, faltantes y mermas).
6. **Hoja de Costos de Importación (*Landed Cost*):** Prorrateo multicriterio (fletes por peso bruto, aranceles y gastos por valor FOB), versionado formal (`BORRADOR`, `EN_REVISION`, `APROBADO`, `A_AJUSTAR`) y determinación del costo unitario final.
7. **Conciliación y Exportación SIRE RCE:** Generación del archivo plano estructurado de compras de importación para SUNAT.

### 2.2. Límites Estrictos y Desacople con el Kardex:
* 🚫 **El Módulo de Importaciones NO administra el Kardex ni almacenes.** La gestión física y tributaria de existencias pertenece al módulo autónomo `src/modules/inventory/`.
* 🚫 **Numerar o registrar una DAM JAMÁS incrementa el inventario.** El ingreso al inventario físico únicamente se produce cuando se confirma el **Acta de Recepción Física (`GoodsReceipt`)**.
* 🚫 **El costeo de importaciones no muta directamente saldos de kardex.** Al aprobarse la Hoja de Costos, `customs` emite el evento de integración `ImportCostApprovedEvent` o invoca el puerto del módulo `inventory` entregando una orden de valorización inmutable con el costo unitario puesto en almacén.
* 🚫 **Los Activos Fijos no se envían al Kardex de existencias.** Si un bien importado se clasifica como `ACTIVO FIJO`, su costo capitalizado se transfiere a contabilidad (NIC 16) sin generar registros en el Kardex de existencias (NIC 2).

---

## 3. Plan de Eliminación de Componentes Obsoletos (Limpieza Anti-Parches)

Para garantizar un código limpio y evitar deuda técnica, se desechan y eliminan los siguientes artefactos del módulo `customs`:

| Componente a Eliminar | Ubicación Anterior | Motivo de Eliminación y Sustitución |
| :--- | :--- | :--- |
| `kardexMovementEntity.ts` | `src/modules/customs/domain/entities/` | **Extracción de Dominio:** Kardex es un subdominio propio; se traslada a `src/modules/inventory/`. |
| `kardexRepositoryPort.ts` | `src/modules/customs/domain/ports/` | **Eliminado:** `customs` no debe poseer contratos de persistencia de kardex. |
| `prismaKardexRepository.ts` | `src/modules/customs/infrastructure/persistence/` | **Eliminado:** El almacenamiento de existencias no pertenece a aduanas. |
| `kardexController.ts` | `src/modules/customs/infrastructure/controllers/` | **Eliminado:** Rutas `/api/v1/customs/kardex/*` quedan obsoletas; reemplazadas por `/api/v1/inventory/*`. |
| `applyLandedCostToKardexUseCase.ts` | `src/modules/customs/application/use-cases/` | **Eliminado:** Reemplazado por `ApproveLandedCostSheetUseCase`, el cual emite un evento desacoplado. |
| Generación sintética de CDA (`generateCda`) | `domain/rules/` | **Riesgo Operativo (H08):** Generaba CDAs falsos con colisiones. Se sustituye por la captura del CDA oficial emitido por SUNAT. |
| Prorrateo con parche de 5 centavos | `domain/rules/ProrationEngine.ts` | **Deficiencia Matemática (H10):** Se reemplaza por aritmética decimal de alta precisión (`Decimal.js`), asignando residuos al ítem de mayor valor. |
| `SireTxtWriterAdapter` (Borrador) | `infrastructure/adapters/` | **Inconsistencia Normativa (H13):** Era un reporte interno no oficial; se reemplaza por el generador normativo RCE (Res. 000112-2021). |
| Fallback `default-company-id` | `application/use-cases/` | **Vulnerabilidad Multi-Tenancy (H01):** Eliminado radicalmente. Todo flujo exige `companyId` autenticado. |

---

## 4. Reglas Matemáticas y de Negocio del Dominio Aduanero

### 4.1. Regla 1: Determinación de la Base Imponible Aduanera (Valor CIF)
$$\text{Valor CIF (USD)} = \text{Valor FOB (USD)} + \text{Flete Internacional (USD)} + \text{Seguro Internacional (USD)} + \text{Ajustes Art. 8 OMC (USD)}$$

* **Tratamiento del Seguro (OMC / TPPS):**
  * Si existe póliza de seguro contratada: se utiliza la prima real pagada.
  * Si no existe póliza: se aplica la **Tabla de Porcentajes Promedio de Seguro (TPPS)** de SUNAT **por subpartida nacional (SPN) individual en cada serie**:
    $$\text{Seguro Teórico Serie}_i = \text{FOB}_i \times \left(\frac{\text{Tasa TPPS}(\text{SPN}_i)}{100}\right)$$
* **Conversión Oficial a Moneda Nacional (PEN):**
  $$\text{Valor CIF (PEN)} = \text{Valor CIF (USD)} \times \text{Tipo de Cambio Oficial Aduanero del Día}$$

### 4.2. Regla 2: Liquidación de Derechos Arancelarios (Ad-Valorem)
Se liquida de manera individual para cada Serie $i$:
$$\text{Ad-Valorem}_i = \text{CIF (PEN)}_i \times \left(\frac{\text{Tasa Ad-Valorem}(\text{SPN}_i)}{100}\right)$$
* Tasas arancelarias del Perú: $0.00\%$, $6.00\%$ u $11.00\%$ según la subpartida nacional.

### 4.3. Regla 3: Liquidación de IGV (15.5%) e IPM (2.5%)
Vigente según el marco tributario peruano (total consolidado 18.0%):
$$\text{Base Imponible IGV/IPM}_i = \text{CIF (PEN)}_i + \text{Ad-Valorem}_i + \text{ISC}_i + \text{Derechos Antidumping}_i$$
$$\text{IGV}_i = \text{Base Imponible}_i \times 0.155$$
$$\text{IPM}_i = \text{Base Imponible}_i \times 0.025$$

### 4.4. Regla 4: Régimen de Percepciones del IGV (Ley N° 28053 / D.Leg. 1714)
$$\text{Base Percepción} = \sum_{i=1}^N \left( \text{CIF (PEN)}_i + \text{Ad-Valorem}_i + \text{ISC}_i + \text{IGV}_i + \text{IPM}_i \right)$$
$$\text{Percepción (PEN)} = \text{Base Percepción} \times \left(\frac{\text{Tasa Percepción}}{100}\right)$$
* **Tasas aplicables:**
  * **$10.0\%$:** Contribuyente con condición de No Habido, RUC con suspensión o sin número de RUC.
  * **$5.0\%$:** Primera importación definitiva efectuada por el contribuyente o importación de mercancías usadas.
  * **$3.5\%$:** Importador frecuente con RUC activo y habido.

### 4.5. Regla 5: Recepción Física de Mercancías (`GoodsReceipt`)
* La recepción física valida:
  $$\text{Diferencia}_i = \text{Cantidad Física Recibida Conforme}_i - \text{Cantidad Declarada DAM}_i$$
* Si $\text{Diferencia}_i \ne 0$, se genera obligatoriamente el **Acta de Discrepancia Aduanera/Comercial**, tipificando si es *Faltante en Origen*, *Merma por Transporte* o *Sobrante*.
* La cantidad física recibida conforme es la única que pasará al costeo e inventario final.

### 4.6. Regla 6: Prorrateo Multicriterio de Costos de Importación (*Landed Cost* — NIC 2)
Para cada serie o producto $i$ ($i = 1, \dots, N$):
1. **Factor de Asignación por Peso Bruto:**
   $$F_{\text{peso}, i} = \frac{\text{Peso Bruto}_i}{\sum_{k=1}^N \text{Peso Bruto}_k}$$
   *Se aplica estrictamente al Flete Internacional, Flete Local terrestre, Manipuleo y Almacenaje en Depósito Temporal.*
2. **Factor de Asignación por Valor FOB:**
   $$F_{\text{fob}, i} = \frac{\text{FOB}_i}{\sum_{k=1}^N \text{FOB}_k}$$
   *Se aplica al Seguro Internacional, Honorarios de la Agencia de Aduanas, Comisiones Bancarias y Vistos Buenos.*
3. **Costo de Adquisición Unitario Puesto en Almacén (PEN):**
   $$\text{Costo Total Adquirido}_i = \text{CIF (PEN)}_i + \text{Ad-Valorem}_i + \text{Gastos Asignados por Peso}_i + \text{Gastos Asignados por Valor}_i$$
   $$\text{Landed Cost Unitario}_i = \frac{\text{Costo Total Adquirido}_i}{\text{Cantidad Recibida Conforme}_i}$$
* **Ajuste de Redondeo Residual:** Si $\sum_{i=1}^N \text{Costo Total Adquirido}_i \ne \text{Total Gastos Incurridos}$, la diferencia de centavos se asigna a la serie de mayor valor FOB, garantizando cuadre exacto al centavo.
* **Exclusión Tributaria Absoluta:** El IGV, IPM y la Percepción jamás forman parte del costo de existencias; se registran como crédito fiscal recuperable.

---

## 5. Arquitectura Hexagonal y Estructura de Directorios

El módulo se estructura bajo Clean Architecture / Domain-Driven Design (DDD). **Ningún archivo del módulo debe superar las 250 líneas de código.** Clases extensas deben subdividirse en componentes especializados.

```text
src/modules/customs/
├── customsModule.ts                                  # Registro NestJS de controladores, servicios y proveedores
│
├── domain/                                           # [CAPA 1: DOMINIO PURO - SIN FRAMEWORKS]
│   ├── entities/
│   │   ├── customsShipmentEntity.ts                  # Expediente comercial de embarque internacional
│   │   ├── customsDeclarationEntity.ts               # DAM/DUA (Formatos A, B y C integrados)
│   │   ├── customsSeriesEntity.ts                    # Serie de DAM con SPN, pesos, destino (bien/activo)
│   │   ├── customsSettlementEntity.ts                # Liquidación aduanera (0010/0026/0027) y CDA
│   │   ├── goodsReceiptEntity.ts                     # Acta de recepción física, mermas y sobrantes/faltantes
│   │   └── landedCostSheetEntity.ts                  # Hoja de costeo versionada (BORRADOR..APROBADO)
│   ├── rules/
│   │   ├── TaxLiquidationEngine.ts                   # Cálculo exacto de tributos, seguros TPPS y percepción
│   │   ├── ProrationEngine.ts                        # Prorrateo multivariado exacto (Peso Bruto y FOB)
│   │   └── VuceComplianceEngine.ts                   # Validación de mercancías restringidas
│   ├── value-objects/
│   │   ├── damNumberVo.ts                            # Formato Aduana-Año-Régimen-Correlativo
│   │   ├── hsCodeVo.ts                               # Subpartida Nacional de 10 dígitos numéricos
│   │   └── cdaNumberVo.ts                            # CDA oficial de SUNAT de 18 dígitos
│   ├── events/
│   │   ├── GoodsReceiptConfirmedEvent.ts             # Evento emitido al recepcionar la carga en almacén
│   │   └── ImportCostApprovedEvent.ts                # Evento emitido con el costo unitario aprobado
│   └── ports/
│       ├── customsShipmentRepositoryPort.ts
│       ├── customsDeclarationRepositoryPort.ts
│       ├── customsSettlementRepositoryPort.ts
│       ├── goodsReceiptRepositoryPort.ts
│       ├── landedCostRepositoryPort.ts
│       ├── customsEventPublisherPort.ts              # Puerto para publicar eventos hacia otros módulos
│       └── sunatExchangeRatePort.ts                  # Consulta de tipo de cambio aduanero
│
├── application/                                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   ├── createShipmentDto.ts
│   │   ├── registerDamWizardDto.ts
│   │   ├── recordCustomsPaymentDto.ts
│   │   ├── confirmGoodsReceiptDto.ts
│   │   ├── calculateLandedCostDto.ts
│   │   └── approveLandedCostDto.ts
│   └── use-cases/
│       ├── createShipmentUseCase.ts                  # Apertura de expediente de importación
│       ├── registerDamWizardUseCase.ts               # Orquestación de registro DAM Formatos A, B y C
│       ├── recordCustomsPaymentUseCase.ts            # Registro de pago bancario de liquidación con CDA
│       ├── applyArt160GuaranteeUseCase.ts            # Aplicación de fianza previa para levante
│       ├── confirmGoodsReceiptUseCase.ts             # Cierre de recepción física y acta de diferencias
│       ├── calculateLandedCostUseCase.ts             # Cálculo y simulación de la hoja de costos
│       ├── approveLandedCostSheetUseCase.ts          # Aprobación final y emisión de orden a Inventario
│       └── adjustLateImportCostUseCase.ts            # Registro de gastos tardíos (demurrage, ajustes)
│
└── infrastructure/                                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   ├── customsShipmentController.ts              # /api/v1/customs/shipments
    │   ├── customsDeclarationController.ts           # /api/v1/customs/declarations
    │   ├── customsSettlementController.ts            # /api/v1/customs/settlements
    │   ├── goodsReceiptController.ts                 # /api/v1/customs/goods-receipt
    │   ├── landedCostController.ts                   # /api/v1/customs/landed-cost
    │   └── customsSirePurchasesController.ts         # /api/v1/customs/sire-purchases
    ├── constants/
    │   ├── sunatCustomsOffices.ts                    # Catálogo estático en TypeScript de 23 aduanas
    │   ├── vuceEntities.ts                           # Catálogo de entidades resolutivas (MTC, DIGESA...)
    │   └── customsInsuranceTpps.ts                   # Tabla oficial de porcentajes de seguro (TPPS)
    ├── adapters/
    │   ├── sireRceFlatFileWriterAdapter.ts           # Generador oficial TXT Compras RCE (Res. 000112-2021)
    │   └── nestCustomsEventPublisherAdapter.ts       # Publicador Outbox / EventEmitter2
    └── persistence/
        ├── prismaCustomsShipmentRepository.ts
        ├── prismaCustomsDeclarationRepository.ts
        ├── prismaCustomsSettlementRepository.ts
        ├── prismaGoodsReceiptRepository.ts
        └── prismaLandedCostRepository.ts
```

---

## 6. Principios SOLID y Buenas Prácticas Innegociables

1. **Single Responsibility Principle (SRP):** Cada caso de uso realiza una única mutación de negocio coordinada. Por ejemplo, `ConfirmGoodsReceiptUseCase` solo atiende la verificación física; no calcula costos ni aprueba pólizas.
2. **Open/Closed Principle (OCP):** El motor arancelario (`TaxLiquidationEngine`) acepta nuevas subpartidas arancelarias y tasas aduaneras mediante catálogos extensibles sin modificar la lógica interna de cálculo.
3. **Liskov Substitution & Interface Segregation (LSP / ISP):** Los puertos de repositorio exponen únicamente los métodos requeridos para su entidad, evitando interfaces gigantes (*fat interfaces*).
4. **Dependency Inversion Principle (DIP):** Las entidades y casos de uso dependen exclusivamente de interfaces (`ports/`), nunca de clases concretas de Prisma o librerías externas.
5. **Regla de < 250 Líneas de Código:** Ningún archivo de producción o test debe superar las 250 líneas. Si un caso de uso o entidad supera este límite, se debe refactorizar delegando responsabilidades a Value Objects o servicios de dominio auxiliares.
6. **Aritmética Decimal de Alta Precisión:** Prohibido el uso del tipo `number` primitivo de JavaScript para dinero, aranceles o factores de prorrateo. Es obligatorio el uso de `Prisma.Decimal` o `Decimal.js` con redondeo bancario (*Half Up*).
7. **Aislamiento Multi-Tenant Estricto (P0):** Todo método de repositorio y caso de uso debe recibir obligatoriamente el parámetro `companyId` proveniente del token JWT verificado. No se permiten fallbacks inseguros.
8. **Idempotencia Transaccional:** El registro de recepciones físicas y la aprobación de costos cuentan con restricción de unicidad en base de datos `(company_id, declaration_id, version)` para impedir duplicidad de registros ante reintentos de red.

---

## 7. Contratos de Puertos de Dominio (Hexagonal)

```typescript
export const CUSTOMS_SHIPMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SHIPMENT_REPOSITORY_PORT');
export const CUSTOMS_DECLARATION_REPOSITORY_PORT = Symbol('CUSTOMS_DECLARATION_REPOSITORY_PORT');
export const CUSTOMS_SETTLEMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SETTLEMENT_REPOSITORY_PORT');
export const GOODS_RECEIPT_REPOSITORY_PORT = Symbol('GOODS_RECEIPT_REPOSITORY_PORT');
export const LANDED_COST_REPOSITORY_PORT = Symbol('LANDED_COST_REPOSITORY_PORT');
export const CUSTOMS_EVENT_PUBLISHER_PORT = Symbol('CUSTOMS_EVENT_PUBLISHER_PORT');

export interface IGoodsReceiptRepositoryPort {
  save(receipt: GoodsReceiptEntity): Promise<GoodsReceiptEntity>;
  findById(id: string, companyId: string): Promise<GoodsReceiptEntity | null>;
  findByDeclarationId(declarationId: string, companyId: string): Promise<GoodsReceiptEntity[]>;
}

export interface ILandedCostRepositoryPort {
  saveSheet(sheet: LandedCostSheetEntity): Promise<LandedCostSheetEntity>;
  findLatestByDeclarationId(declarationId: string, companyId: string): Promise<LandedCostSheetEntity | null>;
  findVersion(declarationId: string, version: number, companyId: string): Promise<LandedCostSheetEntity | null>;
}

export interface ICustomsEventPublisherPort {
  publishReceiptConfirmed(event: GoodsReceiptConfirmedEvent): Promise<void>;
  publishCostApproved(event: ImportCostApprovedEvent): Promise<void>;
}
```

---

## 8. Matriz de Endpoints REST del Módulo

| Método | Endpoint | Descripción | Código Éxito |
| :---: | :--- | :--- | :---: |
| `POST` | `/api/v1/customs/shipments` | Crea un nuevo expediente de importación | `201 Created` |
| `GET` | `/api/v1/customs/shipments` | Lista expedientes con filtros de estado y fechas | `200 OK` |
| `GET` | `/api/v1/customs/shipments/:id` | Obtiene el detalle comercial y documentos del expediente | `200 OK` |
| `POST` | `/api/v1/customs/declarations/simulate` | Simula tributos y liquidación DAM (sin persistir) | `200 OK` |
| `POST` | `/api/v1/customs/declarations` | Registra DAM oficial Formatos A, B y C estructurados | `201 Created` |
| `GET` | `/api/v1/customs/declarations/:id` | Detalle completo de la DAM, series y liquidación C | `200 OK` |
| `POST` | `/api/v1/customs/settlements/:id/pay` | Registra pago bancario de la liquidación con CDA oficial | `200 OK` |
| `POST` | `/api/v1/customs/settlements/:id/guarantee` | Aplica garantía Art. 160 LGA para levante inmediato | `200 OK` |
| `POST` | `/api/v1/customs/goods-receipt` | Registra y confirma Acta de Recepción Física en almacén | `201 Created` |
| `GET` | `/api/v1/customs/goods-receipt/:id` | Consulta acta de recepción y diferencias físicas | `200 OK` |
| `POST` | `/api/v1/customs/landed-cost/calculate` | Genera o actualiza borrador de Hoja de Costos | `200 OK` |
| `POST` | `/api/v1/customs/landed-cost/approve` | Aprueba Hoja de Costos y emite evento hacia Inventario | `200 OK` |
| `POST` | `/api/v1/customs/landed-cost/late-cost` | Registra gasto extemporáneo posterior al levante | `201 Created` |
| `GET` | `/api/v1/customs/sire-purchases/export` | Genera archivo plano RCE Compras de Importación | `200 OK` |

---

## 9. Plan de Pruebas Unitarias y de Integración (`test/`)

1. **`TaxLiquidationEngine.spec.ts` (Unitario):**
   * Determinación de base CIF con póliza real vs seguro de tabla TPPS por subpartida arancelaria.
   * Conversión a PEN usando el tipo de cambio oficial aduanero.
   * Liquidación exacta de Ad-Valorem (0%, 6%, 11%), IGV (15.5%) e IPM (2.5%).
   * Percepción escalonada (10% sin RUC, 5% primera importación / bien usado, 3.5% habitual).
2. **`ProrationEngine.spec.ts` (Unitario):**
   * Prorrateo multivariable exacto: fletes locales y transporte por **Peso Bruto**, agenciamiento y seguros por **Valor FOB**.
   * Garantía de cuadre al centavo exacto: verificación de que la suma de costos unitarios sea igual al total de desembolsos incurridos sin errores de redondeo.
   * Verificación de que el IGV, IPM y la Percepción no formen parte del costo de existencias.
3. **`ConfirmGoodsReceiptUseCase.spec.ts` (Integración):**
   * Cotejo físico: registro de cantidades conformes, dañadas y diferencias.
   * Emisión del evento `GoodsReceiptConfirmedEvent` con la carga lista para almacén.
4. **`ApproveLandedCostSheetUseCase.spec.ts` (Integración):**
   * Aprobación de la Hoja de Costos versionada y emisión de `ImportCostApprovedEvent` con el costo unitario por producto.
   * Verificación de que los productos marcados como `ACTIVO FIJO` no generen movimientos de inventario en almacén comercial.
5. **`sireRceFlatFileWriterAdapter.spec.ts` (Unitario):**
   * Generación del archivo TXT con estructura oficial de compras de importación según la R.S. N° 000112-2021/SUNAT.

---

## 10. Criterios de Aceptación y Definición de Terminado (DoD)

* [ ] El módulo de importaciones no contiene ninguna referencia a repositorios, controladores o tablas directas de Kardex.
* [ ] Toda clase o archivo nuevo respeta el límite estricto de **menos de 250 líneas de código**.
* [ ] Todas las operaciones de base de datos filtran obligatoriamente por `company_id`.
* [ ] La liquidación tributaria contempla los porcentajes vigentes de IGV 15.5% e IPM 2.5%, y seguro TPPS por subpartida.
* [ ] El prorrateo de Landed Cost utiliza Peso Bruto para fletes y Valor FOB para gastos de gestión, cuadrando al centavo exacto.
* [ ] La suite de pruebas de aduanas (`npm test -- test/unit/customs test/e2e/customs`) pasa al 100% sin advertencias.
* [ ] El proyecto compila sin errores de TypeScript (`npm run build`).
