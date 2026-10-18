# Especificación Técnica: Módulo 1 — Facturación Electrónica UBL 2.1

**Responsable Asignado:** Jhordy Salirrosas  
**Módulo:** `src/modules/invoices/`  
**Esquema de BD:** `prisma/schema/invoicing.prisma`  
**Normativa Aplicable:** R.S. N° 097-2012/SUNAT y modificatorias, Estándar OASIS UBL 2.1  

---

## 1. Propósito y Alcance

Gestión integral del ciclo de vida de comprobantes de pago electrónicos (Facturas `01`, Boletas `03`, Notas de Crédito `07` y Notas de Débito `08`):
1. Validación sintáctica de DTOs con `class-validator`.
2. Validación algorítmica de RUC mediante algoritmo Módulo 11 y formato oficial de serie (`F###` / `B###`).
3. Persistencia atómica local en PostgreSQL desacoplada mediante el patrón **Transactional Outbox** y cola `pg-boss`.
4. Generación de XML UBL 2.1 y firma digital en coordinación con el módulo transversal `sunat`.

---

## 2. Reglas Matemáticas y de Negocio Puras (Capa de Dominio)

### 2.1. Regla 1: Algoritmo Módulo 11 para Validación de RUC
* Longitud estricta: 11 dígitos numéricos.
* Prefijos válidos: `10`, `15`, `17` o `20`.
* Ponderación: factores multiplicadores `[5, 4, 3, 2, 7, 6, 5, 4, 3, 2]` aplicados de izquierda a derecha a los primeros 10 dígitos.
* Verificación:
  $$\text{Suma} = \sum_{i=1}^{10} (\text{dígito}_i \times \text{factor}_i)$$
  $$\text{Residuo} = \text{Suma} \pmod{11}$$
  $$\text{Dígito Calculado} = 11 - \text{Residuo}$$
  * Si $\text{Dígito Calculado} = 10 \rightarrow 0$.
  * Si $\text{Dígito Calculado} = 11 \rightarrow 1$.
  * El dígito calculado debe coincidir exactamente con el dígito 11 del RUC.

### 2.2. Regla 2: Cálculo Matemático de IGV (18%) y Base Imponible
$$\text{Base Imponible} = \text{round}\left(\frac{\text{Monto Total}}{1 + 0.18}, 2\right)$$
$$\text{Monto IGV} = \text{round}(\text{Monto Total} - \text{Base Imponible}, 2)$$
$$\text{Total Comprobante} = \text{Base Imponible} + \text{Monto IGV}$$

### 2.3. Regla 3: Formato Oficial de Serie y Correlatividad Consecutiva
* Serie: 4 caracteres alfanuméricos. Facturas inician con `F` (`F001`), Boletas con `B` (`B001`).
* Correlativo: Número entero incremental estrictamente positivo entre `1` y `99999999`. No se permiten saltos de correlatividad.

---

## 3. Estructura de Directorios del Módulo (`src/modules/invoices/`)

```text
src/modules/invoices/
├── invoicesModule.ts                 # Módulo NestJS: registra controladores, casos de uso y providers de puertos
│
├── domain/                           # [CAPA 1: DOMINIO PURO - CERO DEPENDENCIAS EXTERNAS]
│   ├── entities/
│   │   └── invoiceEntity.ts          # Entidad de dominio pura InvoiceEntity
│   ├── ports/
│   │   └── invoiceRepositoryPort.ts  # Contrato IInvoiceRepositoryPort y Symbol INVOICE_REPOSITORY_PORT
│   ├── rules/
│   │   └── calculateIgvRule.ts       # Regla pura de cálculo de IGV 18% y base imponible
│   └── value-objects/
│       └── serieCorrelativoVo.ts     # VO inmutable de validación y formateo F###-00000001
│
├── application/                      # [CAPA 2: CASOS DE USO Y ORQUESTACIÓN]
│   ├── dto/
│   │   └── createInvoiceDto.ts       # DTO con decoradores de validación class-validator
│   ├── use-cases/
│   │   └── createInvoiceUseCase.ts   # Caso de uso: orquesta DTO -> Dominio -> Puerto
│   ├── services/
│   │   └── invoicesService.ts        # Fachada de aplicación para compatibilidad y orquestación
│   └── validators/
│       ├── isRucValidDecorator.ts    # Decorador class-validator que delega al Módulo 11
│       └── isSerieValidDecorator.ts  # Decorador class-validator para series F###/B###
│
└── infrastructure/                   # [CAPA 3: ADAPTADORES TECNOLÓGICOS]
    ├── controllers/
    │   └── invoicesController.ts     # Endpoints HTTP REST (POST /api/v1/invoices)
    ├── guards/
    │   └── apiKeyGuard.ts            # Guard de autorización de la API
    └── persistence/
        └── prismaInvoiceRepository.ts # Adaptador secundario Prisma + pg-boss (implementa puerto)
```

---

## 4. Responsabilidades y Prohibiciones Estrictas por Capa

### 4.1. Capa de Dominio (`domain/`)
* **Qué se hace:** Entidades (`invoiceEntity.ts`), objetos de valor (`serieCorrelativoVo.ts`), reglas matemáticas puras (`calculateIgvRule.ts`) e interfaces de puertos (`invoiceRepositoryPort.ts`).
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar módulos o decoradores de NestJS (`@Injectable`, `@Controller`, etc.).
  * Importar Prisma (`PrismaClient`, `PrismaService`, `@prisma/client`).
  * Importar librerías de base de datos, Axios, Express o APIs externas.
  * Realizar llamadas asíncronas de red o acceso a disco.

### 4.2. Capa de Aplicación (`application/`)
* **Qué se hace:** Casos de uso (`createInvoiceUseCase.ts`), DTOs de entrada y validadores.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Importar o inyectar directamente `PrismaService`.
  * Ejecutar consultas SQL directas (`SELECT`, `INSERT`).
  * Conocer detalles de la base de datos o de protocolos HTTP.
  * **Obligatorio:** Solo debe interactuar con la infraestructura a través de los puertos inyectados mediante token:
    ```typescript
    constructor(
      @Inject(INVOICE_REPOSITORY_PORT)
      private readonly invoiceRepository: IInvoiceRepositoryPort,
    ) {}
    ```

### 4.3. Capa de Infraestructura (`infrastructure/`)
* **Qué se hace:** Controladores REST (`invoicesController.ts`), adaptadores de base de datos (`prismaInvoiceRepository.ts`), guards y clientes externos.
* 🚫 **TERMINANTEMENTE PROHIBIDO:**
  * Contener reglas tributarias o fórmulas matemáticas de negocio (deben residir en `domain/rules/`).
  * Retornar entidades de Prisma directamente si exponen datos sensibles no filtrados.

### 4.4. Fronteras Modulares (Anti-Acoplamiento)
* 🚫 **PROHIBIDO:** Que el módulo `invoices` importe directamente repositorios, tablas o modelos privados de otros módulos (`customs`, `sire`, `accounting`).
* **Comunicación autorizada:** A través de eventos emitidos al Event Bus (`InvoiceCreatedEvent`, `InvoiceAcceptedEvent`) o interfaces públicas exportadas en `invoicesModule.ts`.

---

## 5. Contratos de Puertos de Dominio (Hexagonal)

```typescript
// src/modules/invoices/domain/ports/invoiceRepositoryPort.ts
export const INVOICE_REPOSITORY_PORT = Symbol('INVOICE_REPOSITORY_PORT');

export interface InvoicePersistenceResult {
  id: string;
  estado: string;
  created_at: Date;
}

export interface IInvoiceRepositoryPort {
  saveWithTransactionalOutbox(
    invoice: InvoiceEntity,
  ): Promise<InvoicePersistenceResult>;
}
```

---

## 6. Flujo de Implementación Paso a Paso para el Desarrollador (Workflow)

Cuando Jhordy deba implementar o extender una funcionalidad en este módulo, debe seguir estrictamente este flujo de 6 pasos:

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. DOMINIO   │ ──> │ 2. PUERTO    │ ──> │ 3. USE CASE  │
│ Regla/VO     │     │ Interface    │     │ Aplicación   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 6. TESTS     │ ◄── │ 5. CONTROLADOR│ ◄── │ 4. ADAPTADOR │
│ Unit/E2E     │     │ + Module     │     │ Prisma       │
└──────────────┘     └──────────────┘     └──────────────┘
```

1. **Paso 1 (Dominio Primero):** Crear o modificar la regla de cálculo o VO en `domain/rules/` o `domain/value-objects/`. Escribir de inmediato su prueba unitaria en `test/unit/invoices/<archivo>.spec.ts` y validar que corra en verde.
2. **Paso 2 (Definir el Puerto):** Si se requiere persistencia o comunicación externa, declarar la firma abstracta en `domain/ports/invoiceRepositoryPort.ts`.
3. **Paso 3 (Crear el Caso de Uso):** Crear la clase en `application/use-cases/` inyectando el puerto con `@Inject(INVOICE_REPOSITORY_PORT)`. Escribir su prueba unitaria mockeando el puerto.
4. **Paso 4 (Implementar el Adaptador):** Implementar la lógica de base de datos en `infrastructure/persistence/prismaInvoiceRepository.ts` utilizando `PrismaService` y `QueueService` bajo una transacción atómica.
5. **Paso 5 (Exponer en Controlador y Módulo):** Inyectar el caso de uso en `invoicesController.ts`, registrar el adaptador y el token en `invoicesModule.ts`.
6. **Paso 6 (Verificación Integral Obligatoria):**
   ```bash
   npm test -- test/unit/invoices
   npm run test:e2e
   npm run lint
   npm run build
   ```

---

## 7. Casos de Prueba Requeridos en `test/unit/invoices/`

1. **`calculateIgvRule.spec.ts`:** Cálculo exacto de base e IGV al 18% con centavos.
2. **`serieCorrelativoVo.spec.ts`:** Formato válido F###/B### y rechazo de correlativos negativos o mayores a 8 dígitos.
3. **`isRucValidDecorator.spec.ts`:** Validación algorítmica Módulo 11 (RUCs válidos 20... / 10... y rechazo de RUCs con dígito verificador inválido).
4. **`createInvoiceUseCase.spec.ts`:** Mapeo de DTO a entidad de dominio e invocación correcta del puerto.
5. **`prismaInvoiceRepository.spec.ts`:** Atomicidad de la transacción Prisma + pg-boss y manejo de excepciones con código `OUTBOX_WRITE_FAILED`.
6. **`invoicesController.spec.ts`:** Recepción del DTO y respuesta HTTP 202 con ID generado.

---

## 8. Buenas Prácticas Innegociables y Definition of Done (DoD)

* **Límite de líneas:** Ningún archivo debe exceder las **150 a 200 líneas**. Clases atómicas con responsabilidad única.
* **Cero `any`:** Prohibido el uso de `any`. Usar tipos estrictos, interfaces o `unknown`.
* **Pruebas fuera de `src/`:** Queda terminantemente prohibido crear archivos `.spec.ts` dentro de `src/`.
* **Aislamiento Multi-Tenant:** Toda operación debe vincularse al emisor verificado criptográficamente en el token.
