# Especificación Técnica: Módulo 5 — Contabilidad PCGE y Libros PLE

**Responsable Asignado:** Michael Velásquez  
**Módulo:** `src/modules/accounting/`  
**Esquema de BD:** `prisma/schema/accounting.prisma`  
**Normativa Aplicable:** R.S. N° 286-2009/SUNAT (PLE), Plan Contable General Empresarial (PCGE)  

---

## 1. Propósito y Alcance

Automatización de la contabilidad analítica por partida doble: generación de asientos contables a partir de comprobantes aceptados (`InvoiceAcceptedEvent`) y pólizas liquidadas (`DuaLiquidatedEvent`), validación de balance ($Total Debe = Total Haber$) y exportación de archivos planos oficiales para el Programa de Libros Electrónicos (PLE) con campos delimitados por tuberías (`|`).

---

## 2. Reglas de Negocio Puras (Dominio)

1. **Principio de Partida Doble:**
   $$\sum \text{Debe} = \sum \text{Haber}$$
   Cualquier asiento que presente descuadre centesimal se rechaza de inmediato (`UnbalancedAccountingEntryException`).
2. **Cuentas Normalizadas PCGE:**
   * Ventas: Cargo en `1212` (Cuentas por cobrar), Abono en `40111` (IGV) y `70121` (Ventas).
   * Importaciones: Cargo en `60111` (Mercaderías) y `40111` (IGV Aduanas), Abono en `4212` (Proveedores/Aduana).
3. **Nomenclatura Oficial del Archivo PLE:**
   $$\text{LE} + \text{RUC (11)} + \text{AÑO (4)} + \text{MES (2)} + \text{"00"} + \text{COD\_LIBRO (6)} + \text{"00001111.txt"}$$

---

## 3. Puertos de Dominio

* `IAccountingRepositoryPort`:
  - `saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>`
  - `findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>`
* `IPleExporterPort`:
  - `generatePleTxt(entries: AccountingEntryEntity[], bookCode: string): Promise<string>`
