/**
 * Constructores de nodos XML para el generador UBL 2.1 (M1).
 *
 * Cada función devuelve un fragmento de texto listo para insertar en el
 * documento. Los bloques de partes viven en `xmlPartiesHelper` para mantener
 * este archivo por debajo del límite de líneas del proyecto.
 */
export { bloqueCliente, bloqueEmisor } from './xmlPartiesHelper';
export type { PartyCliente, PartyEmisor } from './xmlPartiesHelper';

/** Escapa los caracteres reservados de XML. */
export const esc = (valor: string | number): string =>
  String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Formatea un importe con dos decimales. */
export const dinero = (importe: number): string => importe.toFixed(2);

/** Bloque de extensiones UBL donde se aloja la firma digital. */
export const bloqueUblExtensions = (): string => `  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent />
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

export interface LineaDetalle {
  id: number;
  descripcion: string;
  codigo?: string;
  unidad?: string;
  cantidad: number;
  valorUnitario: number;
  precioUnitario?: number;
  afectacion: string;
  totalLinea: number;
  igvLinea: number;
}

/** Bloque `<cac:InvoiceLine>` del detalle. */
export const bloqueLinea = (l: LineaDetalle, moneda: string): string => {
  const unidad = l.unidad ?? 'NIU';
  const precio = l.precioUnitario ?? l.valorUnitario * 1.18;
  const neto = dinero(l.totalLinea - l.igvLinea);
  const item = l.codigo
    ? `      <cac:Item>
        <cbc:Description>${esc(l.descripcion)}</cbc:Description>
        <cac:SellersItemIdentification>
          <cbc:ID>${esc(l.codigo)}</cbc:ID>
        </cac:SellersItemIdentification>
      </cac:Item>`
    : `      <cac:Item>
        <cbc:Description>${esc(l.descripcion)}</cbc:Description>
      </cac:Item>`;

  return `  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${esc(unidad)}">${l.cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${neto}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${dinero(precio)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${dinero(l.igvLinea)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${neto}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${dinero(l.igvLinea)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID schemeID="UN/ECE 5305">S</cbc:ID>
          <cbc:Percent>18.00</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${esc(l.afectacion)}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${dinero(l.valorUnitario)}</cbc:PriceAmount>
    </cac:Price>
${item}
  </cac:InvoiceLine>`;
};

export interface CuotaXml {
  numero: string;
  monto: number;
  vencimiento: string;
}

/** Bloque `<cac:PaymentTerms>` con la forma de pago y su cronograma. */
export const bloqueFormaPago = (
  formaPago: string,
  moneda: string,
  cuotas: CuotaXml[],
): string => {
  const cabecera = `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>${esc(formaPago)}</cbc:PaymentMeansID>
  </cac:PaymentTerms>`;

  if (cuotas.length === 0) return cabecera;

  const cronograma = cuotas
    .map(
      (c) => `  <cac:PaymentTerms>
    <cbc:ID>${esc(c.numero)}</cbc:ID>
    <cbc:PaymentMeansID>Cuota</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${dinero(c.monto)}</cbc:Amount>
    <cbc:PaymentDueDate>${esc(c.vencimiento)}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`,
    )
    .join('\n');

  return `${cabecera}\n${cronograma}`;
};

/** Bloque `DiscrepancyResponse` + `BillingReference` de las notas (07/08). */
export const bloqueReferenciaNota = (
  documentoAfectado: string,
  codigoMotivo: string,
  descripcionMotivo: string,
): string => `  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${esc(documentoAfectado)}</cbc:ReferenceID>
    <cbc:ResponseCode>${esc(codigoMotivo)}</cbc:ResponseCode>
    <cbc:Description>${esc(descripcionMotivo)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(documentoAfectado)}</cbc:ID>
      <cbc:DocumentTypeCode>01</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
