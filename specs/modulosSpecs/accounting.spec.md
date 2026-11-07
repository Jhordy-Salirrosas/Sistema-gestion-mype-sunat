# Especificación Técnica de Módulo: 05_ACCOUNTING (Contabilidad PCGE & Libros PLE)
## Guía Operativa para Desarrolladores y Agentes de IA

**Módulo:** `src/modules/accounting/`  
**Responsable Técnico:** Michael Velásquez  
**Normativa SUNAT / Contable:** Plan Contable General Empresarial (PCGE Modificado 2019) y R.S. N° 286-2009/SUNAT (Libros Electrónicos PLE)  
**Estatus:** 🔒 VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito del Módulo
El módulo `accounting` es responsable de:
1. Registro y visualización del **Libro Diario (PLE 5.1)** y **Libro Mayor (PLE 6.1)**.
2. Validación estricta del **Principio de Partida Doble**:
   $$\sum \text{Debe} = \sum \text{Haber}$$
   Ningún asiento contable puede guardarse si existe descuadre ($\Delta > S/ 0.00$).
3. Plan de Cuentas Nacional (PCGE): Validación sintáctica de cuentas contables (Elemento 1 al 9).
4. Generación y exportación de archivos estructurados `.txt` para el **Programa de Libros Electrónicos (PLE)** de SUNAT con la nomenclatura oficial:
   `LE + RUC (11) + AAAAMM00 + 050100 + 00 + 1 + 1 + 1 + 1.txt`

---

## 2. Mapa de Carpetas y Responsabilidades

```text
src/modules/accounting/
├── components/       # DoubleEntryBalanceCard.tsx, AccountingEntryForm.tsx, PleExportModal.tsx, AccountPlanSelector.tsx
├── hooks/            # useAccountingEntries.ts, useCreateEntry.ts, usePleExport.ts
├── pages/            # AccountingEntriesPage.tsx, PleExportPage.tsx
├── services/         # accountingApi.ts (endpoints /accounting/entries, /accounting/ple/export)
├── types/            # accounting.types.ts (AccountingMovement, AccountingEntry, PleExportConfig)
└── validators/       # accountingSchema.ts (validación Zod de cuentas y balance de partida doble)
```

---

## 3. Normativa de Desarrollo (Qué SÍ y qué NO se puede hacer)

### ✅ Lo que SÍ se debe hacer:
* Toda pantalla de creación de asiento debe incluir la tarjeta reactiva [DoubleEntryBalanceCard.tsx](file:///c:/Users/Carlos%20Ahumada%20Soles/OneDrive/Documentos/taller-integrador/fronted-mype-sunat/src/modules/accounting/components/DoubleEntryBalanceCard.tsx) que alerte visualmente si el asiento está cuadrado o descuadrado.
* El esquema Zod `accountingEntrySchema` debe utilizar `.refine()` para impedir el envío si `totalDebe !== totalHaber`.
* Toda cuenta contable ingresada debe validarse contra el PCGE (mínimo 2 dígitos, máximo 6 dígitos numéricos).
* La descarga del archivo `.txt` para PLE debe generarse en codificación Windows-1252 o UTF-8 sin BOM para compatibilidad con el validador oficial de SUNAT.

### 🚫 Lo que está TERMINANTEMENTE PROHIBIDO:
* **PROHIBIDO** permitir el guardado de asientos descuadrados bajo ninguna circunstancia.
* **PROHIBIDO** hardcodear cuentas contables en los componentes; deben provenir del catálogo tipado o del servicio `accountingApi.ts`.
* **PROHIBIDO** realizar la validación de partida doble solo en el backend; el frontend debe validar en tiempo real mientras el usuario digita.
* **PROHIBIDO** escribir componentes de más de 120 líneas.

---

  1. No elimine la validación `.refine()` de partida doble en `validators/accountingSchema.ts`.
  2. Asegure que los campos monetarios de Debe y Haber acepten hasta 2 decimales.
  3. Verifique que `npm run build` pase con 0 errores tras cualquier edición.
  4. Toda prueba debe escribirse en `test/unit/modules/accounting/`, nunca dentro de `src/`.

---

## 5. Estrategia de Pruebas Unitarias (`test/unit/modules/accounting/`)

* **Ubicación Exclusiva:** `test/unit/modules/accounting/`
* **Casos Críticos a Probar:**
  1. **`doubleEntryValidation.test.ts`:** Validación estricta de partida doble ($\sum \text{Debe} == \sum \text{Haber}$), verificando que asientos descuadrados por S/ 0.01 sean rechazados por Zod.
  2. **`financialRatios.test.ts`:** Cálculo de ratios financieros (Liquidez Corriente, Prueba Ácida, Margen Neto).
  3. **`pleTxtGenerator.test.ts`:** Formateo de líneas delimitadas por tuberías (`|`) para libros electrónicos PLE según norma SUNAT.

