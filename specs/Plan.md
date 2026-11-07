# Plan Maestro de Gobernanza y Desarrollo Frontend: SYNC-SUNAT
## Metodología: Spec-Driven Development (SDD) para Equipos de Alto Rendimiento y Agentes de IA

**Proyecto:** SYNC-SUNAT — Sistema de Gestión Financiera y Contable-Tributaria para MYPES  
**Tipo de Aplicación:** Single Page Application (SPA) con React 19 + TypeScript + Vite + Tailwind CSS v4  
**Autor:** Carlos Ahumada Soles (Arquitecto de Software)  
**Destinatarios:** Equipo de Desarrollo Frontend (Jhordy, Oliver, Carlos, Diego, Michael) y Agentes de Inteligencia Artificial (AI Coding Assistants)  
**Ubicación:** `specs/Plan.md`  
**Estatus:** 🔒 CONTRATO OPERATIVO Y NORMATIVA DE DESARROLLO VINCULANTE (Cubre el 70% de la gobernanza técnica)

---

## 1. Declaración de Filosofía: Spec-Driven Development (SDD)

En este proyecto erradicamos el desarrollo intuitivo o no planificado. Se adopta formalmente **Spec-Driven Development (SDD)**:

> **Regla Cero de SDD:**  
> Ningún desarrollador humano ni agente de IA escribirá una sola línea de código en `src/` sin que exista previamente una especificación aprobada en `specs/modulosSpecs/<modulo>.spec.md`.  
> Toda implementación es la materialización directa de un contrato documental previo.

### Objetivos Fundamentales de SDD en SYNC-SUNAT:
1. **Aislamiento Absoluto (Cero *Merge Hell*):** 5 ingenieros trabajando en simultáneo en el mismo repositorio sin colisiones de fusión en Git.
2. **Erradicación del *Frontend Spaghetti*:** Prohibidos los componentes gigantes que mezclan UI, llamadas Axios, lógica contable y estilos.
3. **Determinismo para Agentes de IA:** Los asistentes de IA disponen de un marco delimitado e inequívoco sobre qué carpetas tocar, qué librerías usar y qué límites respetar.

---

## 2. Tesis Arquitectónica: Feature-Driven / Vertical Slice Architecture

El código no se organiza por tipos de tecnología horizontal (`todos_los_componentes/`, `todos_los_servicios/`), sino por **Rebanadas Verticales de Negocio Autónomas (Vertical Slices)** que reflejan simétricamente los *Bounded Contexts* del Backend:

```text
src/
├── config/             # Variables de entorno tipadas y constantes globales
├── components/         # COMPONENTES GLOBALES Y TRANSVERSALES
│   ├── ui/             # Primitivas de shadcn/ui (Radix UI) sin lógica de negocio
│   ├── layout/         # AppLayout, Navbar, Sidebar, PageHeader
│   └── feedback/       # SunatStatusBanner, ErrorBoundaryGlobal, OfflineIndicator
├── hooks/              # Custom Hooks globales (useAuth, useTheme, useDebounce)
├── lib/                # Clientes base (axios.ts, utils.ts, formatters.ts)
├── routes/             # Enrutador central (appRoutes.tsx, ProtectedRoute.tsx)
├── stores/             # Estado cliente Zustand (authStore.ts, uiStore.ts)
└── modules/            # [MÓDULOS VERTICALES AUTÓNOMOS - 1 POR INTEGRANTE]
    ├── auth/           # [Transversal] Autenticación y Multi-Tenancy
    ├── invoices/       # [M1: Jhordy Salirrosas] Facturación Electrónica UBL 2.1
    ├── resilience/     # [M2: Oliver Saldaña] Circuit Breaker, Caos y Dead Letter Queue
    ├── customs/        # [M3: Carlos Ahumada] Liquidación DUA/DAM & Kardex
    ├── sire/           # [M4: Diego Toledo] Conciliación Fiscal SIRE (RVIE / RCE)
    └── accounting/     # [M5: Michael Velásquez] Contabilidad PCGE y Libros PLE

test/                   # ESTRUCTURA CENTRALIZADA DE PRUEBAS (Simétrica al Backend)
├── unit/               # Pruebas unitarias puras (sin renderizado de navegador)
│   ├── lib/            # Pruebas de utilidades transversales (formatters, axios)
│   └── modules/        # 1 carpeta aislada por cada módulo de negocio
│       ├── auth/
│       ├── invoices/
│       ├── resilience/
│       ├── customs/
│       ├── sire/
│       └── accounting/
├── integration/        # Pruebas de integración de componentes y flujos de hooks
└── e2e/                # Pruebas End-to-End simulando usuario en navegador
```

### Regla de Propiedad y Soberanía por Módulo:
* Cada desarrollador es **dueño exclusivo** de su carpeta en `src/modules/<modulo>/`.
* **Está terminantemente prohibido** que un desarrollador edite o agregue archivos dentro del módulo de otro integrante sin previo acuerdo en un Pull Request.
* Las dependencias entre módulos no se hacen importando código interno de otro módulo; se consumen a través de utilidades globales (`src/lib/`, `src/components/ui/`, `src/stores/`).

---

## 3. Principios SOLID Aplicados a React y Regla Anti-Monstruo

### 3.1. La Regla de Oro Anti-Monstruo (< 150 a 200 líneas)
* **Límite Estricto:** Ningún archivo `.tsx` o `.ts` debe superar las **150 a 200 líneas**.
* **Tamaño Ideal:** Componentes enfocados de **40 a 80 líneas**.
* **Acción Obligatoria:** Si un archivo supera las 120 líneas durante su desarrollo, es mandatorio descomponerlo inmediatamente en subcomponentes atómicos dentro de la subcarpeta `components/` de ese módulo.

### 3.2. Mapeo Práctico de SOLID en React

| Principio | Aplicación Obligatoria en el Frontend de SYNC-SUNAT |
|---|---|
| **S - Single Responsibility (SRP)** | • El archivo `.tsx` **SOLO** renderiza JSX y maqueta UI.<br>• El Custom Hook (`.ts`) **SOLO** maneja estado y mutaciones con TanStack Query.<br>• El Service (`.ts`) **SOLO** realiza llamadas HTTP con Axios.<br>• El Validador (`.ts`) **SOLO** contiene esquemas puros con Zod. |
| **O - Open / Closed (OCP)** | Componentes abiertos a extensión mediante `children` y composición (patrón *Compound Components*), sin alterar el código fuente base. |
| **L - Liskov Substitution (LSP)** | Todo componente base en `components/ui/` extiende las propiedades nativas de HTML (`React.ButtonHTMLAttributes`, etc.), permitiendo reemplazo directo sin efectos secundarios. |
| **I - Interface Segregation (ISP)** | No pasar objetos gigantes a componentes que solo necesitan dos propiedades. Usar interfaces pequeñas y específicas en los `props`. |
| **D - Dependency Inversion (DIP)** | Las vistas no dependen directamente de Axios. Dependen de abstracciones expuestas por Custom Hooks (`useInvoicesList`, `useDuaCalculator`). |

### 3.3. Regla de una Única Fuente de UI (Normativa TA-23)
* **Prohibición de HTML y CSS propios en pantallas:** Ninguna pantalla o vista (`pages/`) puede declarar elementos HTML/JSX intrínsecos (`div`, `button`, `input`, etc.), etiquetas `<style>`, estilos inline ni clases de presentación Tailwind. La estructura y presentación visual se componen mediante los componentes exportados desde `@/components/ui`.
* **Importación centralizada obligatoria:** Las pantallas importan los componentes de interfaz exclusivamente desde el punto público `@/components/ui`; no deben importar directamente archivos internos de `src/components/ui/`.
* **Componentes y extensiones:** Los componentes globales de interfaz, incluidos los auxiliares de composición y layout, viven en `src/components/ui/` y se exportan desde `@/components/ui`. Si hace falta una variante o un patrón visual que aún no exista, se añade allí; no se resuelve con JSX o estilos propios de una pantalla. Hooks, servicios, tipos, iconos y lógica de negocio quedan fuera de esta prohibición visual.
* **Consumo exclusivo:** Los controles y patrones visuales compartidos (botones, campos, tablas, diálogos, alertas, paginación, badges, selectores y filtros) se consumen desde `@/components/ui`; no se crean equivalentes locales por pantalla.

---

## 4. Separación Estricta de Responsabilidades por Subcarpeta

Dentro de cada módulo en `src/modules/<modulo>/`, la estructura es **estrictamente simétrica** y cuenta con 6 subcarpetas con límites inviolables:

```text
src/modules/<modulo>/
├── components/     # Subcomponentes visuales atómicos (< 100 líneas)
├── hooks/          # Custom Hooks de orquestación y estado (< 80 líneas)
├── pages/          # Vistas completas vinculadas a las rutas (< 120 líneas)
├── services/       # Clientes HTTP puros con Axios (< 70 líneas)
├── types/          # Interfaces y tipos de TypeScript (< 60 líneas)
└── validators/     # Esquemas declarativos de validación Zod (< 60 líneas)
```

### Tabla de Prohibiciones Estrictas:
| Carpeta | Qué SÍ va aquí | 🚫 Lo que está TERMINANTEMENTE PROHIBIDO |
|---|---|---|
| **`components/`** | Subcomponentes visuales específicos de la feature. Reciben datos por `props` y emiten eventos. | **PROHIBIDO** hacer `fetch` o llamar a Axios directamente. **PROHIBIDO** declarar lógica de negocio compleja. |
| **`hooks/`** | Custom Hooks con `useQuery` / `useMutation` de TanStack Query y estado local de vista. | **PROHIBIDO** contener etiquetas JSX / HTML (`<div>`, `<Button>`, etc.). Es lógica pura de TypeScript. |
| **`pages/`** | Vistas ensambladoras asociadas a las rutas. Unen los subcomponentes del módulo y consumen los hooks. | **PROHIBIDO** sobrepasar las 120-150 líneas. La página no dibuja tablas celda por celda; compone subcomponentes. |
| **`services/`** | Funciones asíncronas puras con `apiClient.get`, `apiClient.post`. | **PROHIBIDO** usar Hooks de React (`useState`, `useEffect`, etc.). No tienen ciclo de vida de UI. |
| **`types/`** | Interfaces TypeScript (`Invoice`, `DuaInput`, `SireVoucher`) que replican DTOs del backend. | **PROHIBIDO** importar componentes de React o lógica ejecutable. Solo definiciones de tipos. |
| **`validators/`** | Esquemas Zod con reglas de validación de comprobantes, RUCs y formularios. | **PROHIBIDO** importar elementos visuales o dependencias de red. |

---

## 5. Gestión del Estado: Server State vs. Client State

Para evitar renderizados innecesarios y estados desfasados:

1. **Server State (TanStack Query v5):**
   * Toda data que provenga del backend (facturas, DUA, asientos, propuestas SIRE) **DEBE** gestionarse con `@tanstack/react-query`.
   * **Anti-patrón Prohibido:** `useEffect(() => { axios.get(...) }, [])` con `useState`.
   * Configuración estándar: `staleTime: 5 minutos`, reintentos automáticos configurados.

2. **Client State (Zustand):**
   * Exclusivamente para estado de sesión (`authStore.ts`) y estado de interfaz global (`uiStore.ts`).
   * No duplicar datos del servidor dentro de Zustand.

---

## 6. Estándares Internacionales UI/UX y Accesibilidad

SYNC-SUNAT no es un prototipo escolar; es una plataforma contable-financiera empresarial regulada por tres estándares internacionales:

### 6.1. ISO 9241-110:2020 (Ergonomía de Interacción Persona-Sistema)
* **Adecuación a la Tarea:** Formularios densos pero claros, solo solicitando casillas tributarias pertinentes al régimen de la MYPE.
* **Autoexplicación:** Campos tributarios complejos (Base imponible, Detracciones, Casilla 4 DAM) deben contener tooltips con referencia a la normativa SUNAT.
* **Tolerancia a Fallos:** La aplicación **nunca bloquea al usuario con pantallas de error 500**. Si SUNAT cae, el `SunatStatusBanner` se activa en ámbar y los comprobantes se resguardan en el **Buffer Local / Outbox**.

### 6.2. WCAG 2.1 (Nivel AA) — Accesibilidad Web
* **Ratio de Contraste:** Mínimo de **4.5:1** para textos estándar y **3:1** para controles interactivos.
* **Navegación 100% por Teclado:** Toda acción de facturación debe ser operable mediante `Tab`, `Shift+Tab`, `Enter` y `Escape`, permitiendo digitación rápida en mostradores comerciales.
* **Semántica ARIA:** Formularios con etiquetas explícitas (`<label htmlFor="...">`) y atributos `aria-invalid`, `aria-describedby` y `role="alert"`.

### 6.3. ISO/IEC 25010 (Calidad de Software y Eficiencia)
* **First Contentful Paint (FCP):** $\le 1.0\text{ s}$.
* **Tamaño del Bundle Inicial:** Menor a **200 KB** (Gzip real actual: **92.38 KB**).
* **Code Splitting Mandatorio:** Toda página en `routes/appRoutes.tsx` debe cargarse con `React.lazy()`.

---

## 7. Nomenclatura y Convenciones de Código Estandarizadas

Para mantener armonía absoluta entre los 5 integrantes:

* **Archivos de Componentes y Páginas:** `PascalCase.tsx` (ej. `InvoiceItemsTable.tsx`, `DuaCalculatorPage.tsx`).
* **Archivos de Lógica, Hooks, Servicios y Utilidades:** `camelCase.ts` (ej. `useInvoicesList.ts`, `customsApi.ts`, `duaSchema.ts`).
* **Tipos e Interfaces:** `PascalCase` con palabra descriptiva (ej. `InvoiceItem`, `CustomsDeclaration`).
* **Constantes Globales:** `UPPER_SNAKE_CASE` (ej. `DEFAULT_EXCHANGE_RATE`, `STORAGE_AUTH_KEY`).
* **Importaciones de Tipos:** Usar obligatoriamente la sintaxis de solo tipos para cumplir con `verbatimModuleSyntax`:
  ```typescript
  import { type Invoice, type CreateInvoiceDto } from '../types/invoice.types';
  ```

---

## 8. Workflow de Desarrollo en 7 Pasos (El Ciclo de Vida de una Feature)

Cada vez que un desarrollador o agente de IA implemente una nueva pantalla:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. CONTRATO     │  ──>  │ 2. SCHEMA       │  ──>  │ 3. SERVICE      │
│ types/*.ts      │       │ validators/*.ts │       │ services/*Api.ts│
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 6. ROUTE        │  ◄──  │ 5. PAGE & ATOMS │  ◄──  │ 4. CUSTOM HOOK  │
│ routes/*.tsx    │       │ pages/ & comp/  │       │ hooks/use*.ts   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │
         ▼
┌───────────────────────────────────────────────┐
│ 7. UNIT TESTS (En test/unit/modules/<m>/)    │
│ Pruebas unitarias de Zod y cálculos tributarios│
└───────────────────────────────────────────────┘
```

1. **Paso 1 (Contrato de Datos):** Definir interfaces en `modules/<m>/types/<m>.types.ts` según los DTOs del backend.
2. **Paso 2 (Validación Zod):** Crear esquemas en `modules/<m>/validators/<m>Schema.ts` con mensajes amigables.
3. **Paso 3 (Servicio API):** Implementar llamadas HTTP en `modules/<m>/services/<m>Api.ts`.
4. **Paso 4 (Custom Hook):** Orquestar la consulta o mutación en `modules/<m>/hooks/use<Feature>.ts` con TanStack Query.
5. **Paso 5 (Subcomponentes y Página):** Crear componentes atómicos (< 100 líneas) en `components/` y ensamblarlos en `pages/<Feature>Page.tsx`.
6. **Paso 6 (Ruta y Lazy Loading):** Registrar la vista en `routes/appRoutes.tsx` usando `React.lazy()` y validar la accesibilidad.
7. **Paso 7 (Prueba Unitaria):** Escribir la prueba en `test/unit/modules/<m>/<feature>.validator.test.ts` verificando que los esquemas rechacen datos inválidos y los cálculos tributarios sean exactos.

---

## 9. Protocolo Estricto de Gobernanza para Agentes de IA

Cuando un Asistente de IA (Antigravity, Cursor, Copilot, etc.) trabaje en este repositorio, **DEBE** acatar las siguientes instrucciones de forma incondicional:

1. **Consulta Mandatoria de Specs:** Antes de modificar un módulo, leer obligatoriamente su archivo en `specs/modulosSpecs/<modulo>.spec.md`.
2. **Prohibición de Edición Cruzada:** Un agente **NO** debe modificar archivos de dos módulos de negocio distintos en la misma tarea, a menos que sea una refactorización transversal aprobada por el Arquitecto (Carlos Ahumada).
3. **Prohibición de Instalación Silenciosa:** El agente no debe instalar librerías externas adicionales por npm sin justificación técnica y autorización expresa. Debe reutilizar `shadcn/ui`, `lucide-react`, `zod`, `axios` y `zustand`.
4. **Validación de Compilación Obligatoria:** Tras realizar cualquier edición, el agente debe verificar que `npx tsc -b` y `npm run build` terminen con **Código 0 (Cero Errores)**.
5. **Ubicación Exclusiva de Tests:** Todo archivo de prueba creado por la IA debe residir en `test/unit/modules/<modulo>/` o `test/unit/lib/`. Está terminantemente prohibido generar archivos `.test.ts` dentro de `src/`.
6. **Registro en Bitácora:** Cada acción relevante, comando ejecutado o error resuelto debe registrarse detalladamente en `docs/redaccionEstructuraFronted.md`.

---

## 10. Gobernanza y Estándar de la Carpeta Centralizada `test/`

Para asegurar la misma disciplina del backend y mantener `src/` exclusivamente con código de producción:

1. **Estructura Estricta:**
   - `test/unit/lib/`: Pruebas de utilidades transversales (formateadores monetarios, fechas, interceptores).
   - `test/unit/modules/<modulo>/`: Espacio soberano de cada desarrollador para sus validadores Zod, cálculos y hooks.
   - `test/integration/`: Pruebas de integración de componentes combinados.
   - `test/e2e/`: Pruebas de usuario final en navegador (Playwright / Cypress).
2. **Reglas de Importación:**
   - Se debe importar el código fuente usando el alias `@/` (ej: `import { invoiceSchema } from '@/modules/invoices/validators/invoiceSchema'`).
3. **Prohibición de `any` en Mocks:**
   - Los datos simulados para tests deben implementar las interfaces de `@/modules/<modulo>/types/`.
