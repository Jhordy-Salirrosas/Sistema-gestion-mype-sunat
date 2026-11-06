# M1: asiento de descuentos 01 y 03

La decisión comunicada por Contabilidad es utilizar la cuenta **74 — Descuentos, rebajas y bonificaciones concedidos**. El generador de asientos `GenerateAccountingEntryUseCase` valida que el código exista entre las cuentas activas obtenidas mediante `findAccounts`; no elige entre 74 y 704 ni exige una de ellas. La semilla incluye ambas; se usa 74 por la decisión explícita, no porque el generador descarte 704. Si 74 no está activa en la base, el puente informa el fallo y no genera el asiento.

M1 suma los descuentos 01 por línea y 03 global declarados en el payload, mantiene la base y el IGV, y reduce el total a cobrar. El asiento carga la cuenta por cobrar por el neto y la 74 por el descuento; abona ventas y tributos por sus importes declarados. Para base 1,000, IGV 180 y descuento 100: debe 1,080 + 100 = haber 1,000 + 180 = 1,180.

Los descuentos 00 y 02 mantienen el cálculo anterior; el Kardex no cambia. Si los descuentos están mal formados o sus cifras no concuerdan con el total declarado, se deja el asiento pendiente de revisión. Cuando hay descuento 01/03, el respaldo contable genérico no debe crear un asiento alternativo sin descuento si el puente falla.

Las pruebas `m1-asiento-descuentos.spec.ts` cubren ambos códigos, el ejemplo y el generador contable real con repositorio simulado, incluyendo ausencia de la cuenta activa. No se emitieron comprobantes ni se modificó el módulo de Contabilidad.

Pendiente de frontend: `InvoiceDescuentoGlobal` e `InvoiceItemsGrid` todavía advierten que el asiento 03/01 se bloqueará. Ese texto deja de reflejar el nuevo comportamiento y debe actualizarse en una rama de front; no se ha modificado en esta corrida backend.
