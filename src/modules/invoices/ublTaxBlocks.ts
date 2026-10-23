/**
 * Bloques tributarios y totales del XML UBL 2.1 (M1).
 *
 * Genera los nodos `TaxTotal` de IGV e ICBPER, los `PaymentTerms` de la
 * detracción y la retención, y el `LegalMonetaryTotal`. Se separa de
 * `ublTotalesHelper` para que ese archivo solo calcule los importes.
 */
import { dinero } from './xmlNodesHelper';
import type { TotalesCalculados } from './ublTotalesHelper';

/** Bloques `TaxTotal` del IGV y del ICBPER. */
export const bloqueImpuestos = (
  t: TotalesCalculados,
  moneda: string,
  tasa: number,
): string[] => {
  const partes: string[] = [
    `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${dinero(t.igv)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${dinero(t.gravado)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${dinero(t.igv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305">S</cbc:ID>
        <cbc:Percent>${(tasa * 100).toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`,
  ];

  if (t.icbper > 0) {
    partes.push(`  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${dinero(t.icbper)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxAmount currencyID="${moneda}">${dinero(t.icbper)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>7152</cbc:ID>
          <cbc:Name>ICBPER</cbc:Name>
          <cbc:TaxTypeCode>OTH</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`);
  }

  return partes;
};

/** Bloques `PaymentTerms` de la detracción y la retención. */
export const bloqueRetenciones = (
  t: TotalesCalculados,
  moneda: string,
): string[] => {
  const partes: string[] = [];

  if (t.detraccion > 0) {
    partes.push(`  <cac:PaymentTerms>
    <cbc:ID>Detraccion</cbc:ID>
    <cbc:PaymentMeansID>Detraccion</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${dinero(t.detraccion)}</cbc:Amount>
  </cac:PaymentTerms>`);
  }

  if (t.retencion > 0) {
    partes.push(`  <cac:PaymentTerms>
    <cbc:ID>Retencion</cbc:ID>
    <cbc:PaymentMeansID>Retencion</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${dinero(t.retencion)}</cbc:Amount>
  </cac:PaymentTerms>`);
  }

  return partes;
};

/** Bloque `LegalMonetaryTotal` con el importe a pagar ya liquidado. */
export const bloqueTotales = (
  t: TotalesCalculados,
  moneda: string,
): string => {
  const base = t.gravado;
  const totalConIgv = base + t.igv;

  return `  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dinero(base)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${moneda}">${dinero(base)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${dinero(totalConIgv)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${moneda}">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="${moneda}">0.00</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="${moneda}">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${moneda}">${dinero(t.importePagar)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;
};
