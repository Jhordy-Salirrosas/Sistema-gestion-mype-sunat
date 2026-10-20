/**
 * Tablas de reglas del validador XSD de UBL 2.1 (M1).
 *
 * Se separan de `xsdValidatorService` para que ese archivo contenga solo la
 * lógica de validación. Las reglas siguen la estructura de los esquemas
 * oficiales UBL-Invoice-2.1.xsd, UBL-CreditNote-2.1.xsd y
 * UBL-DebitNote-2.1.xsd publicados por SUNAT.
 */

/** Raíz XML que corresponde a cada tipo del Catálogo 01. */
export const RAIZ_POR_TIPO: Record<string, string> = {
  '01': 'Invoice',
  '03': 'Invoice',
  '07': 'CreditNote',
  '08': 'DebitNote',
};

export interface ReglaNodo {
  tag: string;
  expectedValue?: string;
  pattern?: RegExp;
  /** Nodo obligatorio solo para estos tipos de comprobante (Catálogo 01). */
  soloPara?: readonly string[];
}

/** Patrón de la serie-correlativo oficial: F001-00000042. */
export const PATRON_ID_COMPROBANTE =
  /^(?:[FB][A-Z0-9]{3}|E[A-Z0-9]{3}|EB[A-Z0-9]{2}|(?:FC|BC|FD|BD)[A-Z0-9]{2})-\d{1,8}$/;

/** Nodos obligatorios del documento UBL. */
export const REGLAS_NODO: ReglaNodo[] = [
  { tag: 'cbc:UBLVersionID', expectedValue: '2.1' },
  { tag: 'cbc:CustomizationID', expectedValue: '2.0' },
  { tag: 'cbc:ID', pattern: PATRON_ID_COMPROBANTE },
  { tag: 'cbc:IssueDate', pattern: /^\d{4}-\d{2}-\d{2}$/ },
  { tag: 'cbc:InvoiceTypeCode', pattern: /^(01|03)$/, soloPara: ['01', '03'] },
  { tag: 'cbc:CreditNoteTypeCode', pattern: /^07$/, soloPara: ['07'] },
  { tag: 'cbc:DebitNoteTypeCode', pattern: /^08$/, soloPara: ['08'] },
  { tag: 'cbc:DocumentCurrencyCode', expectedValue: 'PEN' },
  { tag: 'cac:AccountingSupplierParty' },
  { tag: 'cac:AccountingCustomerParty' },
  { tag: 'cac:TaxTotal' },
  { tag: 'cac:LegalMonetaryTotal' },
  { tag: 'cbc:PayableAmount' },
  { tag: 'cac:DiscrepancyResponse', soloPara: ['07', '08'] },
  { tag: 'cac:BillingReference', soloPara: ['07', '08'] },
];

/** Namespaces obligatorios declarados en la raíz. */
export const NAMESPACES_OBLIGATORIOS = [
  {
    ns: 'xmlns:cac',
    uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  },
  {
    ns: 'xmlns:cbc',
    uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  },
  {
    ns: 'xmlns:ext',
    uri: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  },
] as const;

/** Namespace por defecto que debe declarar la raíz. */
export const uriRaiz = (nombreRaiz: string): string =>
  `urn:oasis:names:specification:ubl:schema:xsd:${nombreRaiz}-2`;
