# Especificación Técnica de Módulo: 03_CUSTOMS (Liquidación DUA/DAM & Kardex)
## Guía Operativa para Desarrolladores y Agentes de IA

**Módulo:** `src/modules/customs/`  
**Responsable Técnico:** Carlos Ahumada Soles (Arquitecto de Software)  
**Normativa SUNAT / Aduanas:** Ley General de Aduanas (D. Leg. N° 1053) e INTA-PG.01 (Despacho Aduanero de Importación para el Consumo)  
**Estatus:** 🔒 VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito del Módulo
El módulo `customs` es responsable de:
1. Liquidación de la **Casilla 4 de la Declaración Aduanera de Mercancías (DAM / DUA)**:
   * **Valor CIF:** $\text{FOB} + \text{Flete} + \text{Seguro}$.
   * **Derecho Arancelario (Ad-Valorem):** $\text{CIF} \times \text{Tasa}$ ($0\%, 4\%, 6\%, 11\%$).
   * **Impuesto General a las Ventas (IGV Aduanero):** $(\text{CIF} + \text{Ad-Valorem}) \times 16\%$.
   * **Impuesto de Promoción Municipal (IPM):** $(\text{CIF} + \text{Ad-Valorem}) \times 2\%$.
   * **Régimen de Percepción del IGV:** $(\text{CIF} + \text{Tributos}) \times 3.5\%$ (o $5\%$ para primera importación).
2. Cálculo del **Landed Cost** (Costo real puesto en almacén peruano).
3. Integración con el **Kardex Permanente Valorizado**: Registro del movimiento de entrada con costo unitario landed cost.

---

## 2. Mapa de Carpetas y Responsabilidades

```text
src/modules/customs/
├── components/       # DuaCalculatorForm.tsx, DuaSummaryCard.tsx, KardexHistoryTable.tsx
├── hooks/            # useDuaCalculator.ts, useRegisterDua.ts, useKardex.ts
├── pages/            # DuaCalculatorPage.tsx, KardexPage.tsx
├── services/         # customsApi.ts (endpoints /customs/calculate, /customs/register, /customs/kardex)
├── types/            # customs.types.ts (DuaInput, DuaCalculationResult, KardexMovement)
└── validators/       # duaSchema.ts (validación Zod de montos FOB/CIF, tasas y RUC)
```

---

## 3. Normativa de Desarrollo (Qué SÍ y qué NO se puede hacer)

### ✅ Lo que SÍ se debe hacer:
* Toda liquidación aduanera debe calcularse tanto en USD como en PEN usando el tipo de cambio oficial de la fecha.
* Si el backend de cálculo aduanero está temporalmente fuera de línea, el hook `useDuaCalculator.ts` debe aplicar el cálculo matemático normativo local como fallback resiliente.
* La tarjeta de resumen `DuaSummaryCard.tsx` debe desglosar con total transparencia cada tributo aduanero (CIF, Ad-Valorem, IGV, IPM, Percepción) cumpliendo la norma **ISO 9241-110 (Autoexplicación de datos)**.
* Toda tabla de movimientos de Kardex debe indicar el documento de referencia (DUA o Factura) y el método de costeo (Promedio Ponderado).

### 🚫 Lo que está TERMINANTEMENTE PROHIBIDO:
* **PROHIBIDO** permitir valores negativos en FOB, Flete o Seguro.
* **PROHIBIDO** mezclar moneda sin convertir: FOB en USD no puede sumarse directamente con tributos en PEN sin el tipo de cambio explícito.
* **PROHIBIDO** escribir formularios de más de 120 líneas; dividir el formulario en subcomponentes (`DuaValuesInputs.tsx`, `DuaTaxesSummary.tsx`).

---

  1. No altere la fórmula de Casilla 4 DAM ($(\text{CIF} + \text{Ad-Valorem}) \times 18\%$) sin validar la base legal de Aduanas.
  2. Mantenga las variables monetarias tipadas y formateadas con `formatCurrency(val, 'USD')`.
  3. Verifique que `npm run build` pase con 0 errores tras cualquier edición.
  4. Toda prueba debe escribirse en `test/unit/modules/customs/`, nunca dentro de `src/`.

---

## 5. Estrategia de Pruebas Unitarias (`test/unit/modules/customs/`)

* **Ubicación Exclusiva:** `test/unit/modules/customs/`
* **Casos Críticos a Probar:**
  1. **`duaCalculator.test.ts`:** Verificación de fórmulas arancelarias: $\text{CIF} = \text{FOB} + \text{Flete} + \text{Seguro}$, $\text{Base IGV/IPM} = (\text{CIF} + \text{Ad-Valorem}) \times 18\%$, y liquidación total en PEN.
  2. **`duaSchema.test.ts`:** Rechazo de importes negativos, validación de formato de DUA (`118-2026-10-XXXXXX`) y tasas arancelarias válidas.
  3. **`kardexCosting.test.ts`:** Prorrateo de costos de importación y cálculo del costo unitario nacionalizado.

