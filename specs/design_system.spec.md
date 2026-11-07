# Especificación Técnica: Sistema de Diseño y Biblioteca de Componentes Web (TA-23)

**Módulo:** Transversal (UI y Diseño)
**Responsables:** Diego Toledo / Oliver Saldaña
**Épica:** UI y Diseño
**Stack Base:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui
**Estatus:** 🔒 NORMATIVA DE DISEÑO VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito

Establecer la **fuente única de verdad** para los estilos, tokens y componentes visuales del frontend de SYNC-SUNAT. Garantiza que ninguna pantalla invente clases CSS sueltas, estilos inline o componentes inconsistentes.

Satisface los requerimientos de usabilidad e interfaces de alta calidad, sentando las bases para accesibilidad WCAG 2.0 (ISO/IEC 40500) y calidad de producto de software (ISO/IEC 25010).

---

## 2. Línea de Diseño y Design Tokens

Todos los estilos emanan de los tokens declarados en `src/index.css` bajo el bloque `@theme` y variables `:root` / `.dark`.

### 2.1. Tipografía
* **Fuente Principal:** `Geist Variable`, sans-serif (`@fontsource-variable/geist`).
* **Escala Tipográfica:**
  * `text-xs`: 12px (0.75rem) — Badges, leyendas, metadatos y tooltips.
  * `text-sm`: 14px (0.875rem) — Texto estándar de tabla, inputs, botones y labels.
  * `text-base`: 16px (1rem) — Texto de lectura y descripciones generales.
  * `text-lg`: 18px (1.125rem) — Cabeceras de tarjetas y diálogos.
  * `text-xl`: 20px (1.25rem) — Títulos de sección y cifras clave.
  * `text-2xl`: 24px (1.5rem) — Títulos principales de página (`PageHeader`).
* **Pesos Tipográficos:** `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-bold` (700).

### 2.2. Paleta de Colores y Tokens Semánticos
* **Identidad MYPE / SUNAT:**
  * `--primary`: Azul corporativo institucional y contrastado para acciones principales.
  * `--secondary`: Superficie complementaria de baja saturación.
  * `--background` / `--foreground`: Fondo blanco puro en claro / carbón profundo en modo oscuro.
  * `--card` / `--border`: Tarjetas elevadas con borde de división sutil (`border-border`).
* **Semántica Tributaria (Estados de Comprobantes y SIRE):**
  * **Aceptado / Conciliado (`success`):** Esmeralda institucional (badge/alerta verde).
  * **Observado (`warning`):** Ámbar de advertencia no bloqueante.
  * **Rechazado / Discrepancia (`destructive`):** Rojo de error fiscal que requiere subsanación.
  * **Enviado / En Proceso (`info`):** Azul cielo representativo de encolado outbox.

### 2.3. Espaciado y Radios de Borde
* **Escala de Espaciado Modular:** Múltiplos de 4px (`gap-1` a `gap-6`, `p-2` a `p-6`).
* **Radios de Borde (`border-radius`):**
  * `--radius-sm`: `calc(var(--radius) * 0.6)` (inputs compactos, tags)
  * `--radius-md`: `calc(var(--radius) * 0.8)` (botones, selectores)
  * `--radius-lg`: `var(--radius)` (tarjetas, modales)
  * `--radius-full`: `9999px` (badges tipo píldora)

### 2.4. Estados de Componentes Interactivos
* **Default:** Estilo base con contraste visual $\ge 4.5:1$.
* **Hover:** Transición suave (`transition-all duration-200`) con aclarado/oscurecido de fondo.
* **Focus-Visible:** Anillo de foco accesible obligatorio (`focus-visible:ring-3 focus-visible:ring-ring/50`).
* **Active:** Micro-interacción táctil (`active:translate-y-px`).
* **Disabled:** `disabled:pointer-events-none disabled:opacity-50`.
* **Aria-Invalid:** Borde destructivo con anillo para campos de formulario con error.

---

## 3. Catálogo de Componentes Reutilizables (10+ Requeridos)

Todos los componentes residen en `src/components/ui/` y se exportan desde `@/components/ui`:

1. `Table`: Tabla accesible para listado de comprobantes y discrepancias SIRE.
2. `Form`: Formulario con validación reactiva y mensajes de error ligados.
3. `Alert`: Banner de retroalimentación con rol accesible `role="alert"`.
4. `Badge`: Etiquetas de estado de comprobante (`ACEPTADO`, `RECHAZADO`, etc.).
5. `Pagination`: Control de navegación de páginas con estados activo y deshabilitado.
6. `FilterBar`: Barra de filtros de búsqueda, selección de estado y fechas.
7. `Dialog`: Modal accesible con trampa de foco y cierre por teclado `Escape`.
8. `Button`: Botón de acción con variantes (`default`, `outline`, `secondary`, `destructive`).
9. `Input`: Campo de texto con accesibilidad ARIA y estados de validación.
10. `Select`: Selector desplegable con soporte para teclado y opciones.
11. `Card`: Contenedor modular con cabecera y cuerpo de contenido.
12. `Separator`: Divisor semántico horizontal o vertical.
