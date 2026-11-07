# Directorio Centralizado de Pruebas — SYNC-SUNAT (`test/`)

> **Estrategia de Aseguramiento de Calidad (QA) para Frontend**  
> Homogénea y simétrica con la arquitectura del backend para el equipo de 5 desarrolladores y asistentes de Inteligencia Artificial.

---

## 🎯 1. Filosofía de Pruebas en el Frontend

En un sistema tributario y financiero como **SYNC-SUNAT**, las pruebas de frontend garantizan que:
1. **Los cálculos tributarios no tengan discrepancias:** Base Imponible + IGV (18%), redondeos a 2 decimales en moneda `PEN` y `USD`.
2. **Las validaciones de negocio prevengan envíos erróneos a SUNAT:** Validación de longitud de RUC (11 dígitos), prefijos válidos (10, 15, 17, 20), montos no negativos y series autorizadas (`F001`, `B001`).
3. **El estado offline y resiliencia funcione:** Almacenamiento seguro en IndexedDB cuando el Circuit Breaker detecte caída de servidores SUNAT.
4. **El código de producción (`src/`) se mantenga 100% limpio:** No se mezclan archivos `.test.ts` ni mocks dentro de `src/`.

---

## 📂 2. Estructura de Directorios de `test/`

```text
test/
├── README.md                      # Esta guía técnica de testing
├── unit/                          # PRUEBAS UNITARIAS (Lógica aislada sin navegador)
│   ├── components/                 # Componentes globales de src/components/ui/
│   │   └── uiComponents.test.tsx   # Roles accesibles, variantes y estados visuales UI
│   ├── lib/                       # Pruebas de utilidades transversales (formatters, axios, env)
│   └── modules/                   # 1 subcarpeta por cada módulo vertical (1 por desarrollador)
│       ├── auth/                  # Pruebas de login, validadores de credenciales y roles
│       ├── invoices/              # Pruebas de validador de facturas, cálculo de IGV y hooks
│       ├── resilience/            # Pruebas de cola offline IndexedDB y estados de contingencia
│       ├── customs/               # Pruebas de calculadora DUA, prorrateos y tributos aduaneros
│       ├── sire/                  # Pruebas de comparador de propuestas RVIE/RCE y discrepancias
│       └── accounting/            # Pruebas de generador de balances, ratios y asientos contables
│
├── integration/                   # PRUEBAS DE INTEGRACIÓN (Interacción entre componentes y hooks)
│   └── (flujos interactivos, modales y formularios combinados)
│
└── e2e/                           # PRUEBAS END-TO-END (Flujos completos en navegador real)
    └── (simulaciones completas: Login -> Emitir Comprobante -> Ver estado en tabla)
```

---

## 🛠️ 3. Reglas de Contribución para los Desarrolladores

Para mantener el orden y evitar conflictos en Git entre los 5 integrantes del equipo:

1. **Aislamiento por Módulo:**
   - Cada desarrollador escribe sus pruebas unitarias **exclusivamente** dentro de su subcarpeta asignada: `test/unit/modules/<su_modulo>/`.
   - Si trabajas en Facturación, crea tus pruebas en `test/unit/modules/invoices/`. No toques las carpetas de tus compañeros.
2. **Importaciones Limpias con Alias `@/`:**
   - Importa siempre el código fuente a probar mediante el alias `@/`:
     ```typescript
     // Correcto:
     import { invoiceSchema } from '@/modules/invoices/validators/invoice.validator';
     import { formatCurrency } from '@/lib/formatters';

     // Prohibido (rutas relativas largas e inestables):
     import { invoiceSchema } from '../../../../src/modules/invoices/...';
     ```
3. **Nomenclatura Estándar:**
   - Todo archivo de prueba debe terminar en `.test.ts` o `.test.tsx` (ejemplo: `invoice.validator.test.ts`, `duaCalculator.test.ts`).
4. **Qué es Obligatorio Probar en Cada Módulo:**
   - **`validators/`:** Esquemas Zod (probar casos de éxito con datos válidos y casos de fallo con datos inválidos).
   - **Cálculos Matemáticos:** Liquidación DUA, desglose de IGV, ratios de liquidez, etc.
   - **Custom Hooks / Transformadores:** Transformación de respuestas de API a modelos de UI.

---

## 🤖 4. Instrucciones Específicas para Agentes de IA

Cuando un asistente de IA escriba o mantenga pruebas en este proyecto:
1. **Ubicación Obligatoria:** Las pruebas **NUNCA** deben crearse dentro de `src/`. Deben residir en `test/unit/modules/<modulo>/` o `test/unit/lib/`.
2. **Prohibición de `any` en Tests:** Los mocks y datos de prueba deben implementar estrictamente los tipos definidos en `@/modules/<modulo>/types/`.
3. **Verificación de Tipos:** Ejecutar `npx tsc -b` para asegurar que las pruebas no rompan el tipado estricto del proyecto.

## 🧪 5. Ejecutar pruebas de componentes UI

El proyecto usa Vitest, jsdom y React Testing Library para verificar los componentes compartidos sin navegador:

```powershell
npm ci
npm test -- test/unit/components/uiComponents.test.tsx
```

Para capturar la salida de la ejecución como evidencia local:

```powershell
npm test -- --reporter=verbose test/unit/components/uiComponents.test.tsx 2>&1 |
  Tee-Object -FilePath "$env:TEMP\test-results-ui-components.txt"
```

El reporte se guarda en la carpeta temporal del usuario y no se agrega al control de versiones.
