/**
 * Plantilla del documento UBL 2.1 (M1).
 *
 * Ensambla el XML completo a partir de los bloques ya construidos. Se separa
 * de `ublGeneratorService` para que ese archivo contenga solo la resolución
 * del payload y respete el límite de líneas del proyecto.
 */

export interface PartesDocumento {
  raiz: 'Invoice' | 'CreditNote' | 'DebitNote';
  documentoId: string;
  tipo: string;
  tipoOperacion: string;
  moneda: string;
  fecha: string;
  hora: string;
  extensiones: string;
  emisor: string;
  cliente: string;
  formaPago: string;
  /**
   * `cac:PaymentMeans` de la detracción (TA-63). Va vacío si no hay detracción.
   * La regla 3034 de la hoja oficial lo exige con `ID = 'Detraccion'` para los
   * tipos de operación 100x.
   */
  mediosPago?: string;
  descuentoGlobal?: string;
  impuestos: string;
  totales: string;
  /**
   * `cac:PaymentTerms` de detracción y retención.
   *
   * Van DESPUÉS de `LegalMonetaryTotal`, no junto a los impuestos: el esquema
   * UBL 2.1 lo exige y SUNAT rechaza el XML con `0306 / cvc-particle 2.1` si
   * aparecen antes. Se separa de `impuestos` por eso.
   */
  retenciones?: string;
  lineas: string;
  /**
   * `cbc:Note`: leyenda 2006 y observaciones.
   *
   * VAN ANTES DE `DocumentCurrencyCode`. En la secuencia de `InvoiceType` del
   * XSD oficial, `cbc:Note` está justo después de `InvoiceTypeCode` (y antes de
   * `TaxPointDate` y `DocumentCurrencyCode`). Emitirlas después hacía que SUNAT
   * rechazara con "found <cbc:Note>, but next item should be
   * AccountingSupplierParty". Se detectó al empezar a generar la leyenda 2006.
   */
  notas: string;
  /**
   * `DiscrepancyResponse` + `BillingReference` de las notas de crédito/débito.
   *
   * DÓNDE VAN Y POR QUÉ NO JUNTO A LAS PARTES
   *
   * Antes se emitían justo después de `AccountingCustomerParty`, que parecía el
   * sitio natural. En `CreditNote`, en cambio, la secuencia del XSD oficial
   * coloca `cac:PayeeParty`, `cac:Delivery`, `cac:PaymentMeans`,
   * `cac:TaxTotal` y `cac:LegalMonetaryTotal` ANTES de donde UBL admite estos
   * nodos, así que SUNAT respondía:
   *
   *   "cvc-particle 2.1: found <cac:DiscrepancyResponse>, but next item should
   *    be {…}LegalMonetaryTotal"
   *
   * Es decir: el nodo existía, pero en una posición que el esquema no permite.
   * Se emitió una NC real contra BETA el 3 nov y el rechazo llegó con ese
   * mensaje.
   *
   * El sitio correcto es ANTES de las partes: en la secuencia de
   * `CreditNoteType` del XSD oficial, `cac:DiscrepancyResponse` (431) y
   * `cac:BillingReference` (464) van justo tras `cac:InvoicePeriod` y antes de
   * `cac:Signature` y `cac:AccountingSupplierParty`. `Invoice`, en cambio, los
   * sitúa en otro punto: por eso la misma línea no servía para las dos raíces.
   *
   * Es un caso donde el orden de nodos es la diferencia entre un XML que SUNAT
   * procesa y uno que no llega a leer.
   */
  referenciaNota?: string;
}

/** Compone el XML UBL 2.1 con la estructura que exige SUNAT. */
export const construirDocumentoUbl = (p: PartesDocumento): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<${p.raiz} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${p.raiz}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
${p.extensiones}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${p.documentoId}</cbc:ID>
  <cbc:IssueDate>${p.fecha}</cbc:IssueDate>
${p.hora ? `  <cbc:IssueTime>${p.hora}</cbc:IssueTime>\n` : ''}
${p.raiz === 'DebitNote' ? '' : `  <cbc:${p.raiz}TypeCode listID="${p.tipoOperacion}">${p.tipo}</cbc:${p.raiz}TypeCode>`}${p.notas}
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha">${p.moneda}</cbc:DocumentCurrencyCode>${p.referenciaNota ? `\n${p.referenciaNota}` : ''}
${p.emisor}${p.cliente}${p.mediosPago ? `\n${p.mediosPago}` : ''}
${p.formaPago}${p.retenciones ? `\n${p.retenciones}` : ''}${p.descuentoGlobal ? `\n${p.descuentoGlobal}` : ''}
${p.impuestos}
${p.totales}
${p.lineas}
</${p.raiz}>`;
