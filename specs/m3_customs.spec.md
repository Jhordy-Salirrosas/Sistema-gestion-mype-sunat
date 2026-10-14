# Especificación Técnica: Módulo 3 — Ingesta Aduanera e Importaciones (DUA/DAM & Kardex)

**Responsable Asignado:** Carlos Ahumada Soles (Arquitecto de Software)  
**Módulo:** `src/modules/customs/`  
**Esquema de BD:** `prisma/schema/customs.prisma`  
**Normativa Aplicable:** Procedimiento Aduanero DESPA-PG.01, R.S. N° 203-2003/SUNAT (Régimen de Percepciones)  

---

## 1. Propósito y Alcance

Permitir a las MYPES importadoras registrar declaraciones aduaneras de mercancías (DUA / DAM formato 10 - Importación para el Consumo), calcular de forma matemática exacta la base imponible aduanera en Dólares (**Valor CIF**), liquidar los tributos de nacionalización en Soles (Ad-Valorem, IGV 16%, IPM 2% y Percepción del IGV) y prorratear los costos de importación para obtener el **Costo Unitario Nacionalizado (Landed Cost)**, impactando el inventario permanente valorizado (**Kardex**) bajo el método de **Promedio Ponderado**.

---

## 2. Reglas Matemáticas y de Negocio Puras (Capa de Dominio)

### 2.1. Regla 1: Cálculo del Valor CIF en Dólares (Casilla 4 de la DAM)
$$\text{Valor CIF (USD)} = \text{FOB (USD)} + \text{Flete Internacional (USD)} + \text{Seguro Internacional (USD)}$$
*Restricción:* Todos los valores deben ser estrictamente positivos y expresados con dos decimales exactos (`DECIMAL(14, 2)`).

### 2.2. Regla 2: Conversión a Moneda Nacional (Soles)
$$\text{CIF (PEN)} = \text{CIF (USD)} \times \text{Tipo de Cambio Oficial Venta SUNAT}$$

### 2.3. Regla 3: Liquidación de Derechos Arancelarios (Ad-Valorem)
$$\text{Ad-Valorem (PEN)} = \text{CIF (PEN)} \times \left(\frac{\text{Tasa Ad-Valorem}}{100}\right)$$
*Tasas permitidas según la subpartida nacional:* $0.00\%$, $6.00\%$ u $11.00\%$.

### 2.4. Regla 4: Liquidación de IGV (16%) e IPM (2%)
$$\text{Base Imponible IGV/IPM} = \text{CIF (PEN)} + \text{Ad-Valorem (PEN)}$$
$$\text{IGV + IPM (PEN)} = \text{Base Imponible IGV/IPM} \times 0.18$$

### 2.5. Regla 5: Liquidación de Percepción del IGV (R.S. 203-2003/SUNAT)
$$\text{Base Percepción (PEN)} = \text{CIF (PEN)} + \text{Ad-Valorem (PEN)} + \text{IGV/IPM (PEN)}$$
$$\text{Percepción (PEN)} = \text{Base Percepción (PEN)} \times \left(\frac{\text{Tasa Percepción}}{100}\right)$$
*Tasas normadas:* $3.5\%$ (importador habitual), $5.0\%$ (primera importación) o $10.0\%$ (sin RUC activo).

### 2.6. Regla 6: Prorrateo de Costos y Costo Unitario Nacionalizado (Landed Cost)
Para cada ítem o serie de la DUA ($i$):
$$\text{Landed Cost Unitario (PEN)}_i = \frac{\text{CIF Prorrateado (PEN)}_i + \text{Ad-Valorem Prorrateado (PEN)}_i}{\text{Cantidad}_i}$$
*Nota Contable:* El IGV/IPM y la Percepción no forman parte del costo del inventario porque constituyen **Crédito Fiscal** deducible para la MYPE.

### 2.7. Regla 7: Actualización de Kardex Valorizado (Promedio Ponderado)
$$\text{Nuevo Stock} = \text{Stock Anterior} + \text{Cantidad Ingresada}$$
$$\text{Nuevo Valor Total} = \text{Valor Total Anterior} + \text{Total Costo Ingreso}$$
$$\text{Nuevo Costo Promedio Unitario} = \frac{\text{Nuevo Valor Total}}{\text{Nuevo Stock}}$$

---

## 3. Contratos de Entrada y Salida (DTOs)

### `RegisterDuaDto`
```typescript
export class RegisterDuaDto {
  dua_number: string;          // Formato '118-2026-10-012345'
  customs_agency_code: string; // '118' Marítima Callao
  numeration_date: string;     // ISO Date 'YYYY-MM-DD'
  fob_value_usd: number;
  freight_value_usd: number;
  insurance_value_usd: number;
  exchange_rate: number;       // Tipo de cambio SUNAT
  ad_valorem_rate: number;     // 0, 6 u 11
  perception_rate: number;     // 3.5, 5.0 o 10.0
  items: Array<{
    item_order: number;
    hs_code: string;           // '8471.30.00.00'
    commercial_description: string;
    quantity: number;
    unit_code: string;
    fob_unit_usd: number;
  }>;
}
```

---

## 4. Puertos e Interfaces de Dominio (Hexagonal)

* `ICustomsRepositoryPort`:
  - `save(declaration: CustomsDeclarationEntity): Promise<CustomsDeclarationEntity>`
  - `findByDuaNumber(duaNumber: string, companyId: string): Promise<CustomsDeclarationEntity | null>`
* `IKardexRepositoryPort`:
  - `registerMovement(movement: KardexMovementEntity): Promise<void>`
  - `getLatestBalance(itemCode: string, companyId: string): Promise<KardexBalanceVO>`

---

## 5. Casos de Prueba Requeridos

1. **Unit Tests:**
   * Cálculo de CIF exacto con valores decimales.
   * Separación contable exacta: tributos que van al costo (Ad-Valorem) vs tributos que van a crédito fiscal (IGV, Percepción).
   * Exactitud del Promedio Ponderado en Kardex ante múltiples entradas y salidas.
2. **Integration Tests:**
   * Persistencia en PostgreSQL de cabecera DUA + ítems + movimientos Kardex bajo una sola transacción.
