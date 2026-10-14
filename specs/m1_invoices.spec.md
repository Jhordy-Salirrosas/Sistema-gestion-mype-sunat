# Especificación Técnica: Módulo 1 — Facturación Electrónica UBL 2.1

**Responsable Asignado:** Jhordy Salirrosas  
**Módulo:** `src/modules/invoices/`  
**Esquema de BD:** `prisma/schema/invoicing.prisma`  
**Normativa Aplicable:** R.S. N° 097-2012/SUNAT y normas modificatorias, Estándar OASIS UBL 2.1  

---

## 1. Propósito y Alcance

Gestión integral de comprobantes de pago electrónicos (Facturas `01`, Boletas `03`, Notas de Crédito `07` y Notas de Débito `08`): validación sintáctica de DTOs, validación algorítmica de RUC con Módulo 11, emisión con bloqueo pesimista en `invoice_series`, generación de XML UBL 2.1, firma digital XAdES-BES con certificados X.509, comunicación SOAP con `billService` de SUNAT y almacenamiento del CDR en Supabase Storage.

---

## 2. Reglas de Negocio Puras (Dominio)

1. **Algoritmo Módulo 11 de RUC:** Valida matemáticamente que el RUC emisor y receptor sea de 11 dígitos, inicie con `10`, `15`, `17` o `20` y cumpla con la suma ponderada del factor `[5, 4, 3, 2, 7, 6, 5, 4, 3, 2]`.
2. **Control de Correlatividad Consecutiva:** No puede existir salto ni duplicidad en la numeración dentro de una serie fiscal. La serie se incrementa bajo `SELECT ... FOR UPDATE`.
3. **Cálculo de IGV (18%):**
   $$\text{IGV} = \text{Operaciones Gravadas} \times 0.18$$
   $$\text{Total Comprobante} = \text{Gravadas} + \text{Exoneradas} + \text{Inafectas} + \text{IGV}$$
4. **Notas de Crédito y Débito:** Requieren obligatoriamente la referencia al comprobante afectado (`referenced_document_type`, `referenced_series_correlative`) y el código del motivo de anulación o ajuste (Catálogo 09 o 10 de SUNAT).

---

## 3. Puertos de Dominio (Hexagonal)

* `IInvoiceRepositoryPort`:
  - `save(invoice: InvoiceEntity): Promise<InvoiceEntity>`
  - `findById(id: string, companyId: string): Promise<InvoiceEntity | null>`
  - `getNextCorrelative(companyId: string, docType: string, series: string): Promise<number>`
* `ISunatGatewayPort`:
  - `sendBill(zipBuffer: Buffer, fileName: string): Promise<SunatResponseVO>`
* `ISignaturePort`:
  - `signXml(xmlString: string, pfxBuffer: Buffer, password: string): Promise<string>`

---

## 4. Casos de Prueba Requeridos

1. Unitarias: Validación de Módulo 11 (`ruc.vo.spec.ts`), regla de cálculo IGV (`calculate-igv.rule.spec.ts`).
2. Integración: Emisión atómica Factura + Outbox en PostgreSQL.
3. E2E: Ciclo completo `POST /api/v1/invoices` $\rightarrow$ Respuesta HTTP 202 $\rightarrow$ Worker $\rightarrow$ CDR.
