/**
 * Barril del motor de cálculo tributario del módulo M1 (Facturación Electrónica
 * UBL 2.1).
 *
 * Mantiene un único punto de importación (`@/modules/invoices/lib/invoiceCalculations`)
 * mientras la implementación vive dividida por responsabilidad:
 *  - `./invoiceTaxes`           -> redondeo, IGV 18%, Catálogo 07 e ICBPER.
 *  - `./invoiceRetentions`      -> detracción SPOT, retención 3% y liquidación.
 *  - `./invoiceCreditAndRules`  -> cuotas al crédito, plazo de envío, letras y QR.
 */
export * from './invoiceTaxes';
export * from './invoiceRetentions';
export * from './invoiceCreditAndRules';
