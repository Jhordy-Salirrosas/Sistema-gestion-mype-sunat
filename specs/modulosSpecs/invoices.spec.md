# Especificación Técnica de Módulo: 01_INVOICES (Facturación UBL 2.1)
## Guía Operativa para Desarrolladores y Agentes de IA

**Módulo:** `src/modules/invoices/`  
**Responsable Técnico:** Jhordy Salirrosas  
**Normativa SUNAT:** Resolución de Superintendencia N° 097-2012/SUNAT y estándar UBL 2.1  
**Estatus:** 🔒 VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito del Módulo
El módulo `invoices` es responsable de:
1. Emisión de Facturas Electrónicas (`F001-XXXX`) y Boletas de Venta (`B001-XXXX`) bajo el estándar UBL 2.1.
2. Cálculo automático de tributos: Subtotal, Operaciones Gravadas, Inafectas, Exoneradas e IGV (18%).
3. Seguimiento del ciclo de vida del CDR (Constancia de Recepción de SUNAT):
   * `EN_COLA_OUTBOX`: Comprobante resguardado localmente mientras el Circuit Breaker detecta caídas de SUNAT.
   * `ACEPTADO_SUNAT`: CDR emitido con código 0 y firma XML válida.
   * `FALLO_CRITICO`: Error irrecuperable en Dead Letter Queue (DLQ), con opción de *"Reintentar ahora"*.
   * `RECHAZADO_SUNAT`: Error tributario de validación SUNAT (ej. RUC no habido).

---

## 2. Mapa de Carpetas y Responsabilidades

```text
src/modules/invoices/
├── components/       # Subcomponentes (InvoiceForm.tsx, InvoiceItemsTable.tsx, CdrStatusBadge.tsx, InvoiceTotalsSummary.tsx)
├── hooks/            # useInvoicesList.ts, useCreateInvoice.ts, useCalculateTaxes.ts
├── pages/            # InvoicesListPage.tsx, CreateInvoicePage.tsx, InvoiceDetailPage.tsx
├── services/         # invoicesApi.ts (endpoints /invoices, /invoices/:id/retry-cdr)
├── types/            # invoice.types.ts (Invoice, InvoiceItem, CdrStatus, CreateInvoiceDto)
└── validators/       # invoiceSchema.ts (validación Zod de serie, RUC, productos, montos)
```

---

## 3. Normativa de Desarrollo (Qué SÍ y qué NO se puede hacer)

### ✅ Lo que SÍ se debe hacer:
* Toda tabla de facturas debe renderizar el estado del comprobante usando el componente [CdrStatusBadge.tsx](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/fronted-mype-sunat/src/modules/invoices/components/CdrStatusBadge.tsx).
* Todo importe monetario debe formatearse obligatoriamente con el helper `formatCurrency(monto, 'PEN' | 'USD')`.
* Toda fecha debe formatearse con `formatDateToPeru(fecha)`.
* La pantalla de emisión debe validar en tiempo real que el RUC tenga 11 dígitos con prefijos válidos (10, 15, 17, 20) antes de enviar la petición.
* Si un formulario de factura crece más de 120 líneas, debe dividirse en:
  - `InvoiceCustomerSection.tsx` (Datos del receptor / RUC)
  - `InvoiceItemsTable.tsx` (Detalle de productos)
  - `InvoiceTotalsSummary.tsx` (Subtotal, IGV y Total)

### 🚫 Lo que está TERMINANTEMENTE PROHIBIDO:
* **PROHIBIDO** crear una pantalla `CreateInvoicePage.tsx` gigante de más de 150 líneas.
* **PROHIBIDO** hacer cálculos matemáticos de impuestos directamente en el JSX; los cálculos deben realizarse en `useCalculateTaxes.ts` o en el validador Zod.
* **PROHIBIDO** llamar a `axios.post` dentro de los botones de la tabla; usar la mutación del hook `useCreateInvoice.ts`.
* **PROHIBIDO** mostrar estados de "Error 500" al usuario si SUNAT está caída; se debe mostrar el estado `EN_COLA_OUTBOX` de forma transparente.

---

## 4. Instrucciones Específicas para Agentes de IA
* Cuando agregue o edite una vista en `src/modules/invoices/`:
  1. No altere la interfaz `Invoice` en `types/` sin verificar compatibilidad con el backend.
  2. Asegure que la tabla de comprobantes sea operable mediante teclado (accesibilidad WCAG 2.1 AA).
  3. Verifique que `npm run build` pase con 0 errores tras cualquier edición.
  4. Toda prueba debe escribirse en `test/unit/modules/invoices/`, nunca dentro de `src/`.

---

## 5. Estrategia de Pruebas Unitarias (`test/unit/modules/invoices/`)

* **Ubicación Exclusiva:** `test/unit/modules/invoices/`
* **Casos Críticos a Probar:**
  1. **`invoiceSchema.test.ts`:** Validación de RUC (11 dígitos, prefijos válidos 10/20), rechazo de montos negativos, validación de series autorizadas (`F001`, `B001`).
  2. **`taxCalculation.test.ts`:** Comprobación matemática de Operaciones Gravadas + 18% IGV = Total, sin descuadres de centavos.
  3. **`useInvoices.test.ts`:** Verificación del consumo de `invoicesApi` y estados devueltos por TanStack Query.

