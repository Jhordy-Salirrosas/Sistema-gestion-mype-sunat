# Auditoría del módulo de Contabilidad (SYNC-SUNAT)

**Fecha:** 2026-11-13 · **Rama:** `feat/contabilidad-auditoria` (backend, desde `dev`) · **Alcance:** backend NestJS + Prisma; frontend revisado para UI de distribución/subcuentas.

Este documento es el resultado de la **tarea 1** (auditoría de reglas y asientos) y de la
identificación de **tarea 5** (regularización de históricos). No corrige nada por sí solo: fija el
estado real del módulo para no reimplementar lo que ya existe y para priorizar lo que falta.

---

## 1. Método

- Lectura del código de `src/modules/accounting/**`, `expenses`, `collections`, `purchases` e
  `invoices/accountingBridge`.
- Contraste de **todas** las cuentas PCGE usadas en código y en semillas contra
  `prisma/seeds/pcge2019.ts` (1 700 cuentas) y contra la estructura padre/hija del catálogo.
- Línea base ejecutada en local: `nest build` ✅ y `jest test/unit/accounting` ✅ (86 pruebas antes
  de esta rama, 120 después).
- **No** se pudo ejecutar nada contra base de datos real: el repositorio no trae `DATABASE_URL` y no
  hay instancia local. Las comprobaciones de datos son por consulta y quedan cubiertas por la
  auditoría en línea (`GET /api/v1/accounting/audit`).

## 2. Lo que YA existe (no rehacer)

| Pieza | Estado | Ubicación |
| --- | --- | --- |
| Asientos automáticos VENTA / COMPRA / RECEPCION / PAGO / GASTO / COBRO / AJUSTE | Implementados | `defaultAccountingRules.ts`, `invoiceAccountingBridge`, `purchasesService`, `expensesService`, `collectionsService`, `inventoryTransferService` |
| Partida doble | Validada (tolerancia 0.01) | `domain/rules/doubleEntryRule.ts` |
| Idempotencia | `idempotency_key` único por empresa en asientos de venta, gasto, cobro y pagos | `accounting.prisma` (`@@unique([company_id, idempotency_key])`) |
| Nota de crédito (07) | Invierte las líneas de la venta y revierte el costo | `accountingBridge.lineasAsientoNotaCredito`, `revertirCostoNota` |
| Anulación de gasto y cobro | Genera asiento inverso + movimiento de tesorería inverso | `expensesService.annul`, `collectionsService.annul` |
| Períodos y años fiscales | Cierre/apertura con reglas de arrastre | `prismaAccountingRepository` |
| Reglas y mapeos por empresa | `accounting_rules` + `accounting_mapping` con endpoints `GET/PUT /rules` y `/mappings` | `accountingController` |
| PLE base y cierre anual | Exportadores y asiento de cierre | `exportPleTxtUseCase`, `exportTaxPleUseCase`, `generateClosingEntryUseCase` |

## 3. Hallazgos

Severidad: **A** = rompe la contabilidad o el PLE; **B** = riesgo operativo; **C** = deuda menor.

### A1. Reglas por defecto apuntan a cuentas de mayor con subcuentas

`defaultAccountingRules.ts` usa cuentas que existen en el PCGE pero **no son hoja**:

| Proceso / línea | Código | Por qué está mal |
| --- | --- | --- |
| VENTA 9 (descuento) | `74` | Elemento: cuelgan `741`, `7411`, `74111`, `7412` |
| RECEPCION 2 | `611` | Cuelgan `6111` |
| AJUSTE 1 (faltante) | `659` | Cuelgan `6591`, `6592` |
| AJUSTE 3 (sobrante) | `759` | Cuelgan `7591`…`7599` |

El asiento sigue cuadrando, así que ningún control de partida doble lo detecta: el daño es de
**clasificación**, no de balance, y se propaga al Libro Mayor y al PLE.

> El `74` **no es un error de tipeo**: `specs/M1-ASIENTO-DESCUENTOS.md` documenta que Contabilidad
> decidió usar la cuenta 74 para los descuentos 01/03 que no afectan la base. La decisión es del
> contador; lo que falta es elegir la **subcuenta** (`7411`/`7412`) o mantener 74 como excepción
> documentada. **No se modifica sin su confirmación.**

### A2. Los asientos automáticos no validan sus cuentas

`generateAccountingEntryUseCase` valida existencia, cuenta inactiva y “cuenta de mayor con
subcuentas” **solo cuando `sourceModule === 'MANUAL'`**. Los siete procesos automáticos escriben el
`account_code` de la regla sin comprobarlo; si la regla está mal, el asiento se crea igual.

### A3. Errores contables silenciados en Compras

`purchasesService.registrarAsientoCompra` y `registrarAsientoRecepcion` envuelven todo en
`try/catch` y solo hacen `logger.error`. Resultado: la compra responde 201 aunque el asiento no se
haya creado, y el usuario no se entera. Mismo patrón en `purchasesService.payPurchase` cuando las
reglas PAGO están incompletas (ahí sí lanza).

### A4. Dos verdades para el mismo asiento de venta

`RegisterInvoiceAccountingEntryUseCase` (registrado en `accountingModule` pero **sin ningún
llamador**) construye el asiento de venta con cuentas fijas (`12121/70121/40111/401119`) y sin
descuentos, detracción, retención ni ICBPER. El camino real es
`invoiceAccountingBridgeService.registrarAsiento`. Es código muerto que puede resucitar como
segunda fuente de verdad: hay que eliminarlo o reducirlo a un adaptador del puente.

### A5. Numeración de asientos sin lock

`prismaAccountingRepository.getNextEntryNumber` hace `findFirst` + `1` fuera de transacción. Dos
emisiones concurrentes del mismo período calculan el mismo número y la segunda falla por
`@@unique([company_id, period, entry_number])` con un error de base, no con un reintento. Pasa a
ser visible ahora que la emisión es concurrente (cola + reintentos).

### A6. Códigos de cuenta inválidos en el mapeador

- `accountingController.getAccountingMappings` propone `61111` para `COMPRA/VARIACION_EXISTENCIA`:
  **no existe** en el catálogo (el usuario ya lo había advertido).
- `TRANSFERENCIA/ALMACEN_DESTINO` propone `20111.02`: **no existe** y además lleva punto, formato que
  el PCGE no usa y que rompe el PLE.

### B1. Sin distribución de gastos ni cobros

`Expense` y `Collection` son de una sola cuenta (la que digan las reglas `GASTO`/`COBRO`). No hay
tablas de distribución, ni endpoints, ni UI. Es la **tarea 2** íntegra.

### B2. Sin subcuentas de caja/banco

El catálogo semilla no tiene `1011`, `1012`, `1013` ni `1043`, y los servicios **hardcodean** la
cuenta: `'101'` para efectivo y `'1041'` para banco en `expensesService:152`,
`collectionsService:223` y `purchasesService:521`. Tesorería no puede elegir cuenta. Es la
**tarea 3** íntegra.

### B3. PLE 5.1 no cumple el formato oficial

`exportPleTxtUseCase` emite 9 columnas (`período|CUO|Mnnn|cuenta|debe|haber|glosa|1|`) y **omite la
denominación de la cuenta**, que el PLE exige; el correlativo de línea se escribe `M001` en lugar
del correlativo del asiento. Requiere contrastar contra la R.S. 286-2009 antes de presentarlo.

### B4. Cierre anual usa una cuenta agregada

`generateClosingEntryUseCase` cierra 6 y 7 contra `59` (Resultados acumulados), que tiene hijas
(`591`, `592`). Debería cerrar contra subcuenta (`591`/`592`) o contra las cuentas de cierre del
ejercicio, y decidir si el resultado se determina antes de cerrar.

### C1. `idempotency_key` nula no protege

La restricción única admite muchos `NULL`, así que un asiento sin clave no está protegido contra
duplicados. Los caminos principales sí pasan clave; los de compras/recepción no.

### C2. `20111.02`/`1212` en documentación

La especificación `m5_accounting.spec.md` sigue describiendo la cuenta `1212` para ventas, ya
corregida en código a `12121`. La documentación arrastra el defecto corregido.

## 4. Lo que se agregó en esta rama

**Tarea 1 — auditoría de reglas y asientos**

- `domain/rules/catalogIntegrityRule.ts`: reglas puras de integridad (cuenta inexistente, inactiva,
  de mayor con subcuentas, líneas obligatorias por proceso, línea duplicada, lado inválido, cuenta
  repetida).
- `application/use-cases/auditAccountingUseCase.ts` + `GET /api/v1/accounting/audit`: auditoría de
  solo lectura que devuelve, en una sola llamada, los hallazgos de configuración y de datos de
  **tarea 1** y **tarea 5**: reglas inválidas/incompletas, asientos descuadrados o sin líneas,
  asientos duplicados por referencia, líneas con cuentas inválidas, comprobantes aceptados sin
  asiento y ventas cuyo inventario salió sin asiento de costo.

**Tarea 2 — distribución de gastos y cobros**

- Tablas `expense_distributions` y `collection_distributions` (migración
  `20261114140000_accounting_distributions`).
- `domain/rules/distributionRule.ts`: reparto por importes o porcentajes, suma exacta con tolerancia
  de un céntimo, sin cuentas repetidas, ajuste de redondeo en la última línea.
- Los asientos de gasto y de cobro generan una línea por cuenta; el IGV y la cuenta por pagar siguen
  saliendo de las reglas del proceso.
- Endpoints `GET/PUT /expenses/:id/distributions`, `POST /expenses/:id/post` (reintento) y
  `GET/PUT /collections/:id/distributions`. Una distribución no se puede cambiar si el documento ya
  tiene asiento: hay que anular y volver a registrar.
- UI: componente `AccountDistributionEditor` en Gastos y Cobros.

**Tarea 3 — subcuentas de caja y banco**

- Tabla `company_treasury_accounts` (migración `20261114130000_accounting_treasury_accounts`): alias
  operativo de la empresa ("BCP cuenta corriente", "Caja chica") sobre una **subcuenta del PCGE**.
- El catálogo base gana `1011`, `1012`, `1013` y `1043`; `1041` y `1042` ya existían con su nombre
  oficial y **no se renombran**: el nombre del banco vive en el alias de la empresa.
- Endpoints `GET/POST /accounting/treasury-accounts` y `PUT /:id`, con validación de cuenta
  existente, activa y hoja.
- Los asientos de pago de gasto, pago de compra y cobro usan la subcuenta elegida.
- UI: selector en Gastos (diálogo de pago) y Cobros, y gestión en Contabilidad → Plan de cuentas.
- **Libro Mayor con detalle**: al consultar una cuenta de mayor se incluyen sus subcuentas
  (`104` muestra `1041`, `1042`, `1043`) y la respuesta indica cuáles se sumaron. Antes el mayor de
  una cuenta padre salía vacío porque las líneas viven en las hijas.
- **Saldo final corregido**: se calculaba solo con el movimiento del período e ignoraba el saldo de
  apertura; ahora cierra con el arrastre incluido.

**Tarea 5 — regularización de históricos**

- `AccountingRegularizationService` + `POST /api/v1/invoices/accounting/reprocess`: toma los
  comprobantes aceptados sin asiento, los reprocesa con el mismo puente contable (idempotente) y
  devuelve cuántos se regularizaron, cuántos se omitieron y cuáles fallaron.
- **Trabaja en seco por defecto**: solo con `{ "dryRun": false }` escribe. Tope de 500 por lote.
- No inventa costos ni cuentas: si el comprobante no tiene costo valorizado en el Kardex, el puente
  lo reporta como pendiente y no crea un asiento de costo.

**Tarea 6 — estructura de los libros PLE**

- `domain/rules/pleStructureRule.ts`: saneo de campos (una tubería o un salto de línea dentro de una
  glosa corría las columnas o partía el registro), línea terminada en tubería, coherencia del número
  de columnas, RUC del emisor con dígito verificador y detección de comprobantes repetidos.
- La validación del RUC por módulo 11 se extrajo a `common/validators/ruc.ts` para que el decorador
  de la emisión y la exportación PLE usen la misma aritmética.
- Los exportadores 5.1/3.1 y 14.1/8.1 rechazan un archivo con filas inconsistentes o con
  comprobantes duplicados en lugar de generar un TXT que SUNAT devolvería sin explicar la línea.
- El libro 14.1/8.1 devuelve ahora `totales` (base gravada, IGV y total) para contrastarlos con la
  contabilidad.
- El **5.1 Libro Diario** pasa de 8 columnas a las **21 del formato**: período, CUO, correlativo del
  asiento (con prefijo `M` de movimiento), cuenta, unidad de operación, centro de costos, moneda,
  documento del emisor, comprobante, fecha contable, vencimiento, fecha de operación, glosa, glosa
  referencial, debe, haber, dato estructurado y estado. Antes el debe, el haber y la glosa estaban
  corridos nueve posiciones, así que el archivo no se podía presentar. Los campos sin dato en el
  asiento (unidad de operación, centro de costos, documento del emisor y comprobante) se emiten vacíos
  a propósito: no se inventan.

**Tarea 7 — cierre anual de extremo a extremo**

- `test/unit/accounting/annualCloseE2E.spec.ts` recorre el flujo completo con el repositorio real y
  una base en memoria: abrir el año, contabilizar venta, costo, compra y gasto, comprobar que el
  balance de comprobación cuadra, cerrar el período, rechazar asientos tardíos, generar el asiento de
  cierre, cerrar el año, no duplicar el cierre al repetirlo y abrir el año siguiente.

**A3 — errores contables silenciados en Compras**

- `registrarAsientoCompra` y `registrarAsientoRecepcion` devuelven `{ asientoGenerado, motivo }` y la
  respuesta de la compra incluye `contabilidad`, en lugar de registrar la compra y responder 201 como
  si el asiento se hubiera creado.

**Tarea 4 — anulación: primero lo que no dependía de una decisión**

- La comunicación de baja (RA) ya no incluye comprobantes de un período **cerrado** o cuyo libro del
  período **ya se generó en el PLE**: se marcan como no anulables con el motivo explícito y el camino
  queda en la nota de débito o de crédito. Cubre la regla "después de declarar no se elimina" sin
  inventar un campo nuevo: usa el estado del período y los libros PLE, que ya existen.
- El reverso de venta, Kardex y costo ya estaba resuelto por la nota de crédito y por el servicio de
  reversión de la baja; no se tocó esa lógica.
- **Pendiente de decisión**: revertir automáticamente los cobros asociados a una venta anulada. Hoy
  el cobro se anula por su propio endpoint; hacerlo en cascada cambia el flujo de tesorería y conviene
  acordarlo antes.

**A5 — numeración de asientos ante emisiones simultáneas**

- `saveEntry` reintenta con el siguiente número cuando dos emisiones del mismo período calculan el
  mismo `entry_number` (P2002), y devuelve el asiento existente cuando el conflicto es de
  `idempotency_key`. Antes, la segunda emisión terminaba en un error de base sin explicación.

**UI de auditoría**

- Página `/accounting/auditoria`: muestra los hallazgos de reglas, asientos y comprobantes, y permite
  simular y ejecutar la regularización de pendientes (en seco primero).

**Pruebas**: el módulo de contabilidad pasa de 86 a 198 pruebas (111 nuevas: reglas, auditoría,
tesorería, distribución, PLE, cierre y concurrencia), más 3 en compras, 9 en el frontend de
contabilidad (1 326 en total) y las 1 318 previas siguen verdes.

## 5. Pendiente (tareas 4 y 6) y por qué

- **Tarea 4 — resto**: el bloqueo de la baja en períodos declarados ya está. Falta decidir si la
  anulación de una venta revierte en cascada sus cobros (hoy el cobro se anula por su endpoint) y si
  la nota de débito se genera desde el mismo flujo o queda como documento aparte.
- **Tarea 6 — resto**: el 5.1 ya tiene la estructura de 21 columnas, pero el orden se tomó de la
  descripción del formato y no del PDF oficial de la R.S. 286-2009, que este entorno no pudo abrir.
  Antes de presentar el primer archivo hay que contrastarlo con la hoja oficial, y falta el libro
  **6.1 Libro Mayor**, que hoy no se exporta.
- **Tarea 7 — resto**: la prueba de cierre corre sobre una base en memoria; falta ejecutarla contra
  PostgreSQL, que no está disponible en este entorno (`DATABASE_URL` vacío) y no debe correrse contra
  producción sin respaldo.

## 6. Decisiones que necesito del contador

1. **Descuentos 01/03**: ¿se mantiene `74` (y se acepta la excepción) o se usa `7411 Terceros`?
   Hoy la semilla no tiene una hoja válida bajo `74` distinta de `74111` (que ya se usa para ICBPER,
   y cuyo nombre en la semilla no coincide con el PCGE 2019).
2. **Faltantes/sobrantes de inventario**: el catálogo no tiene hoja bajo `659` para faltantes
   (`6591` Donaciones, `6592` Sanciones). ¿Se agrega la cuenta que use la empresa o se mueve el
   ajuste a `69`?
3. **Cierre anual**: ¿resultado contra `591`/`592` o contra las cuentas de cierre `88`/`89`?

## 7. Orden de trabajo propuesto

1. ✅ Auditoría + endpoint + pruebas (esta rama).
2. ✅ Subcuentas de caja/banco (catálogo + selección en tesorería + uso en asientos) — **tarea 3**.
3. ✅ Distribución de gastos y cobros (tablas, endpoints, UI, asiento) — **tarea 2**.
4. ✅ Propagación de errores contables en Compras (`contabilidad` en la respuesta) — **A3**.
5. ◐ Anulación/reversión: baja bloqueada en período declarado ✅; cascada de cobros pendiente — **tarea 4**.
6. ✅ Regularización de históricos usando la auditoría como fuente — **tarea 5**.
7. ◐ PLE: estructura, RUC, duplicados y 21 columnas del 5.1 ✅; falta contrastar con el PDF oficial y el libro 6.1 — **tarea 6**.
8. ◐ Cierre anual: E2E con repositorio real en memoria ✅; falta contra PostgreSQL — **tarea 7**.
9. ✅ Numeración segura ante emisiones simultáneas — **A5**.
10. ✅ UI de auditoría con simulación y ejecución de la regularización.
