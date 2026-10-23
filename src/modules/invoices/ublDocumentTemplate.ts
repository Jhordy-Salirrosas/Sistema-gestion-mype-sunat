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
  impuestos: string;
  totales: string;
  lineas: string;
  /** Bloques opcionales: observaciones, orden de compra y referencia de nota. */
  opcionales: string;
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
  <cbc:IssueTime>${p.hora}</cbc:IssueTime>
  <cbc:${p.raiz}TypeCode listID="${p.tipoOperacion}">${p.tipo}</cbc:${p.raiz}TypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha">${p.moneda}</cbc:DocumentCurrencyCode>${p.opcionales}
${p.emisor}${p.cliente}
${p.formaPago}
${p.impuestos}
${p.totales}
${p.lineas}
</${p.raiz}>`;
