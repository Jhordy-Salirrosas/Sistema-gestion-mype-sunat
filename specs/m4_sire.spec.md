# Especificación Técnica: Módulo 4 — Conciliación Fiscal SIRE

**Responsable Asignado:** Diego Toledo  
**Módulo:** `src/modules/sire/`  
**Esquema de BD:** `prisma/schema/sire.prisma`  
**Normativa Aplicable:** R.S. N° 112-2021/SUNAT, R.S. N° 040-2022/SUNAT  

---

## 1. Propósito y Alcance

Automatizar la conciliación mensual del Sistema Integrado de Registros Electrónicos (**SIRE**): ingesta de propuestas oficiales de SUNAT para **RVIE** (Ventas - Libro 140000) y **RCE** (Compras - Libro 080000), cruce masivo multidimensional mediante llave compuesta (`RUC + TipoDoc + Serie + Correlativo`), detección de discrepancias en centavos y clasificación de registros en los **4 estados tributarios**.

---

## 2. Reglas del Motor de Cruce Multidimensional (Dominio)

Para cada comprobante analizado en el periodo fiscal:

1. **Escenario 1: `COINCIDENCIA_EXACTA`**  
   El comprobante existe en la base de datos local y en la propuesta de SUNAT, y los importes coinciden dentro de una tolerancia de redondeo de $\pm 0.05$ soles:
   $$|\text{Base Imponible}_{\text{local}} - \text{Base Imponible}_{\text{sire}}| \le 0.05 \quad \land \quad |\text{IGV}_{\text{local}} - \text{IGV}_{\text{sire}}| \le 0.05$$
2. **Escenario 2: `DIFERENCIA_MONTOS`**  
   El comprobante existe en ambos lados pero la diferencia en base imponible o IGV supera los 0.05 soles.
3. **Escenario 3: `OMISION_LOCAL`**  
   El comprobante está presente en la propuesta del SIRE de SUNAT, pero la MYPE no lo tiene registrado en su contabilidad local.
4. **Escenario 4: `OMISION_SUNAT`**  
   El comprobante fue emitido o recibido por la MYPE localmente, pero SUNAT no lo incluyó en su propuesta mensual.

---

## 3. Puertos de Dominio

* `ISireProposalRepositoryPort`:
  - `saveBatch(proposals: SireProposalEntity[]): Promise<void>`
  - `findByPeriod(companyId: string, period: string, bookType: string): Promise<SireProposalEntity[]>`
* `ISireReconciliationRepositoryPort`:
  - `saveReconciliation(reconciliation: SireReconciliationEntity): Promise<SireReconciliationEntity>`
