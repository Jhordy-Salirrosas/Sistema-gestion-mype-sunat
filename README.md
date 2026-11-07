# SYNC-SUNAT — Frontend Web

> **Sistema de Gestión Financiera y Contable-Tributaria para Micro y Pequeñas Empresas (MYPES)**  
> Desarrollado con React 19, TypeScript, Vite, Tailwind CSS v4 y shadcn/ui.

---

## 📌 1. Sobre el Proyecto

**SYNC-SUNAT** es una plataforma web modular diseñada para que las MYPES gestionen sus operaciones comerciales, financieras y obligaciones tributarias ante la **SUNAT** de manera ágil, confiable y automatizada.

### Funcionalidades Principales
1. **Facturación Electrónica (CPE):** Emisión y consulta de Facturas (`01`), Boletas (`03`), Notas de Crédito (`07`) y Débito (`08`) con cálculo de IGV (18%), estados de validez SUNAT y descarga de representaciones impresas (PDF) y XML homologados.
2. **Resiliencia & Contingencia Offline:** Motor de contingencia con cola local (IndexedDB) para emitir comprobantes sin interrupción durante caídas de servidores SUNAT, con sincronización automática en segundo plano.
3. **Importaciones & Aduanas:** Liquidación de Declaraciones Únicas de Aduanas (DUA), prorrateo de costos de importación (FOB, Flete, Seguro, Ad-Valorem, IGV/IPM) e integración con inventarios.
4. **Integración SIRE (RVIE / RCE):** Comparador automático entre registros contables internos y las propuestas del Sistema Integrado de Registros Electrónicos (SIRE) de SUNAT, detección de discrepancias y generación de archivos de reemplazo.
5. **Contabilidad & Reportería Tributaria:** Estado de Situación Financiera (Balance General), Estado de Resultados, Libro Mayor, proyección del Impuesto a la Renta (Régimen MYPE Tributario) y ratios financieros clave (liquidez, solvencia, rentabilidad).
6. **Autenticación & Multi-Tenant:** Acceso seguro mediante JWT, gestión de roles (Administrador, Contador, Facturador, Visualizador) y aislamiento de datos por RUC de empresa (`X-Tenant-Id`).

---

## 🛠️ 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) | Librería base con soporte para React Actions y transiciones concurrentes |
| **Lenguaje** | [TypeScript 6](https://www.typescriptlang.org/) | Tipado estático estricto y seguro de punto a punto |
| **Bundler / Dev Server** | [Vite 8](https://vite.dev/) | Compilación HMR ultrarrápida y optimización ESM |
| **Estilos & UI** | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Biblioteca oficial del frontend; componentes en `src/components/ui/`, importados desde `@/components/ui` |
| **Gestión Asíncrona & Cache** | [TanStack React Query v5](https://tanstack.com/query/latest) | Manejo de estado remoto, caché inteligente y revalidación |
| **Estado Global** | [Zustand](https://zustand.docs.pmnd.rs/) | Store global liviano con persistencia local de sesión (`authStore`, `uiStore`) |
| **Cliente HTTP** | [Axios](https://axios-http.com/) | Interceptores automáticos de Bearer Token, cabecera `X-Tenant-Id` y manejo de 401 |
| **Validación de Datos** | [Zod v4](https://zod.dev/) | Validación rigurosa de esquemas en formularios y variables de entorno |
| **Formularios** | [React Hook Form](https://react-hook-form.com/) | Formularios desacoplados de alto rendimiento con validadores Zod |
| **Enrutamiento** | [React Router v7](https://reactrouter.com/) | Rutas protegidas con Code-Splitting por módulo (`React.lazy`) |

---

## 🏛️ 3. Metodología de Desarrollo: Spec-Driven Development (SDD)

Este proyecto se desarrolla bajo el estándar de **Desarrollo Guiado por Especificaciones (SDD)** para garantizar uniformidad entre los miembros del equipo y los asistentes de Inteligencia Artificial:

- 📋 **[Plan de Gobernanza General (`specs/Plan.md`)](specs/Plan.md):** Contrato técnico del proyecto. Define estándares de arquitectura, responsabilidades SOLID, regla de archivos limpios (< 150 líneas) y convenciones de nomenclatura.
- 📑 **[Especificaciones Modulares (`specs/modulosSpecs/`)](specs/modulosSpecs/):** Cada módulo de negocio tiene una especificación detallada con sus contratos de API, pantallas, hooks y componentes:
  - `00_auth.spec.md`: Autenticación, sesión y cambio de tenant/empresa.
  - `01_invoices.spec.md`: Emisión y gestión de comprobantes de pago electrónicos.
  - `02_resilience.spec.md`: Monitor de contingencia y cola offline SUNAT.
  - `03_customs.spec.md`: Declaraciones Únicas de Aduanas (DUA) e importaciones.
  - `04_sire.spec.md`: Conciliación de ventas (RVIE) y compras (RCE) con SUNAT.
  - `05_accounting.spec.md`: Libros contables, balances y estados financieros.
- 🎨 **[Línea de Diseño y Tokens (`docs/linea-de-diseno.md`)](docs/linea-de-diseno.md):** Documentación formal de tokens sobre Tailwind v4 (tipografía, colores OKLCH, espaciados, radios y los 5 estados interactivos).
- 🧩 **[Guía de Uso de Componentes (`docs/guia-de-componentes.md`)](docs/guia-de-componentes.md):** Catálogo de componentes web reutilizables (`@/components/ui`) con un ejemplo de código por componente.
- 🔎 **[Auditoría Lighthouse local (`docs/evidencia-lighthouse-local.md`)](docs/evidencia-lighthouse-local.md):** Evidencia reproducible de la compilación local; no sustituye la medición pendiente sobre el despliegue público.

---

## 📂 4. Estructura de Carpetas

El código fuente utiliza **Vertical Slice Architecture** (arquitectura modular por dominio):

```text
src/
├── assets/                  # Recursos estáticos (logos, íconos)
├── components/              # Componentes compartidos y transversales
│   ├── layout/              # AppLayout, Navbar, Sidebar, PageHeader
│   ├── shared/              # SunatStatusBanner, ErrorBoundary, OfflineIndicator
│   └── ui/                  # Primitivas shadcn/ui (Button, Card, Badge, Dialog...)
├── config/                  # Configuración validada (env.config.ts)
├── hooks/                   # Custom hooks globales (useAuth, useTheme, useDebounce)
├── lib/                     # Utilidades e instancias core (axios.ts, formatters.ts)
├── modules/                 # MÓDULOS DE NEGOCIO VERTICALES
│   ├── auth/                # Sesión, Login, Multi-tenancy
│   ├── invoices/            # Facturación electrónica
│   ├── resilience/          # Monitor de contingencia y cola offline
│   ├── customs/             # Módulo de Aduanas (DUA)
│   ├── sire/                # Integración SIRE (RVIE/RCE)
│   └── accounting/          # Contabilidad y balances tributarios
│       └── [cada módulo contiene]:
│           ├── components/  # Widgets y componentes visuales del módulo
│           ├── hooks/       # Hooks de negocio y React Query mutations/queries
│           ├── pages/       # Vistas de página principales
│           ├── services/    # Clientes de API con Axios
│           ├── types/       # Modelos y contratos TypeScript
│           └── validators/  # Esquemas de validación Zod
├── routes/                  # Configuración de rutas (appRoutes.tsx, ProtectedRoute.tsx)
└── stores/                  # Estados globales Zustand (authStore.ts, uiStore.ts)

test/                        # DIRECTORIO CENTRALIZADO DE PRUEBAS (Simétrico al Backend)
├── README.md                # Guía y lineamientos de QA para desarrolladores e IA
├── unit/                    # Pruebas unitarias aisladas
│   ├── lib/                 # Pruebas de utilidades transversales (formatters, env)
│   └── modules/             # Pruebas unitarias organizadas por módulo (1 por desarrollador)
│       ├── auth/            # Pruebas de validadores y store de autenticación
│       ├── invoices/        # Pruebas de esquemas Zod y cálculo de IGV 18%
│       ├── resilience/      # Pruebas de Circuit Breaker y cola IndexedDB
│       ├── customs/         # Pruebas de cálculo de liquidación DUA (CIF, Ad-Valorem)
│       ├── sire/            # Pruebas de conciliación RVIE/RCE y filtros
│       └── accounting/      # Pruebas de partida doble (Debe == Haber) y ratios
├── integration/             # Pruebas de integración de componentes y modales
└── e2e/                     # Pruebas End-to-End simulando usuario en navegador
```

---

## 🚀 5. Guía de Instalación y Puesta en Marcha

Sigue estos pasos para clonar, configurar y levantar el proyecto en tu máquina local sin errores:

### Requisitos Previos
- **Node.js:** Versión `20.x` o superior (se recomienda Node `22 LTS`).
- **npm:** Versión `10.x` o superior (incluido con Node.js).
- **Git:** Instalado en tu sistema.

---

### Paso 1: Clonar el Repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd fronted-mype-sunat
```

---

### Paso 2: Instalar Dependencias
Instala todos los paquetes requeridos por el proyecto:

```bash
npm install
```

> 💡 **Nota:** Si ocurre algún conflicto puntual en dependencias, puedes usar `npm install --legacy-peer-deps`.

---

### Paso 3: Configurar Variables de Entorno
El proyecto valida estrictamente las variables de entorno con **Zod** al arrancar. Si falta alguna variable, la aplicación te indicará el campo exacto en la consola.

1. Crea tu archivo local `.env` a partir de la plantilla `.env.example`:

   **En Windows (PowerShell):**
   ```powershell
   Copy-Item .env.example .env
   ```

   **En Windows (CMD):**
   ```cmd
   copy .env.example .env
   ```

   **En macOS / Linux (Bash):**
   ```bash
   cp .env.example .env
   ```

2. Verifica o ajusta el contenido de tu `.env`:
   ```env
   # URL Base de la API del Backend (Spring Boot / NestJS / Node)
   VITE_API_URL=http://localhost:8080/api/v1

   # Entorno de SUNAT activo: BETA (Homologación/Pruebas) | PRODUCCION (Emisión Real)
   VITE_SUNAT_ENV=BETA

   # Nombre identificador del aplicativo
   VITE_APP_NAME=SYNC-SUNAT
   ```

---

### Paso 4: Iniciar el Servidor de Desarrollo
Ejecuta el servidor local de Vite con Hot Module Replacement (HMR):

```bash
npm run dev
```

Abre tu navegador en:
👉 **[http://localhost:5173](http://localhost:5173)**

---

### Paso 5: Credenciales de Prueba (Modo Mock / Desarrollo)
Para navegar por la aplicación durante el desarrollo local:
- **RUC Empresa:** `20601234567`
- **Usuario:** `admin@syncsunat.pe`
- **Contraseña:** `Admin123*`

*(Si la API del backend aún no está encendida, el interceptor y mock de desarrollo te permitirán inspeccionar layouts y vistas).*

---

## ⚡ 6. Scripts Disponibles en `package.json`

| Comando | Acción | Cuándo Usarlo |
| :--- | :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:5173` | Durante el desarrollo cotidiano |
| `npm run build` | Ejecuta la verificación de tipos (`tsc -b`) y empaqueta la app para producción en `/dist` | **Siempre antes de hacer commit o abrir un Pull Request** |
| `npm run preview` | Levanta un servidor local que sirve los archivos compilados de `/dist` | Para auditar rendimiento y verificar la build final |
| `npm run lint` | Ejecuta ESLint en todos los archivos del proyecto | Para asegurar la higiene y calidad del código |

---

## 🛡️ 7. Reglas de Contribución para los Desarrolladores

Para mantener el código ordenado y evitar conflictos entre los 5 integrantes del equipo:

1. **Aislamiento por Módulo:** Trabaja exclusivamente dentro de tu carpeta en `src/modules/<tu_modulo>/`. No modifiques carpetas de otros compañeros sin previa coordinación.
2. **Uso de TypeScript Estricto:**
   - La opción `verbatimModuleSyntax: true` está activa: para importar interfaces o tipos utiliza siempre `import { type MiTipo } from './types'`.
   - No utilices `any`. Tipa explícitamente DTOs y respuestas de API.
3. **Regla de las 150 Líneas:** Ningún componente o hook debe superar las 150 líneas de código. Si una vista crece, extrae subcomponentes en su carpeta `components/`.
4. **Validación de Formularios:** Todo formulario que capture datos debe ser validado con esquemas Zod en `validators/` y enlazado con `react-hook-form`.
5. **No commitear secretos ni archivos privados:**
   - El archivo `.env` nunca debe subirse al repositorio (está protegido en `.gitignore`).
   - Los apuntes y archivos locales privados deben mantenerse fuera del repositorio; las guías compartidas de `docs/` sí forman parte de la documentación del proyecto.
6. **Estrategia Centralizada de Pruebas:**
   - Todo archivo de test debe ubicarse dentro de `test/unit/modules/<tu_modulo>/`.
   - Está prohibido crear archivos `.test.ts` dentro de `src/` para mantener el código de producción limpio.
   - Importa el código fuente a probar usando el alias `@/` (ejemplo: `@/modules/invoices/validators/...`).
   - Consulta [`test/README.md`](test/README.md) para más detalles.

---

## 👥 8. Equipo de Desarrollo & Asignación de Módulos

| Integrante | Módulo Asignado | Especificación de Negocio | Carpeta de Pruebas Unitarias |
| :--- | :--- | :--- | :--- |
| Desarrollador 1 | **Facturación Electrónica** | [`specs/modulosSpecs/invoices.spec.md`](specs/modulosSpecs/invoices.spec.md) | `test/unit/modules/invoices/` |
| Desarrollador 2 | **Resiliencia & Contingencia SUNAT** | [`specs/modulosSpecs/resilience.spec.md`](specs/modulosSpecs/resilience.spec.md) | `test/unit/modules/resilience/` |
| Desarrollador 3 | **Aduanas e Importaciones (DUA)** | [`specs/modulosSpecs/customs.spec.md`](specs/modulosSpecs/customs.spec.md) | `test/unit/modules/customs/` |
| Desarrollador 4 | **Integración SIRE (RVIE/RCE)** | [`specs/modulosSpecs/sire.spec.md`](specs/modulosSpecs/sire.spec.md) | `test/unit/modules/sire/` |
| Desarrollador 5 | **Contabilidad & Balances MYPE** | [`specs/modulosSpecs/accounting.spec.md`](specs/modulosSpecs/accounting.spec.md) | `test/unit/modules/accounting/` |


---

## 📄 9. Licencia

Proyecto académico y profesional para Taller Integrador de Sistemas. Todos los derechos reservados © 2026.
