/**
 * Constructores de nodos XML para el generador UBL 2.1 (M1).
 *
 * Cada función devuelve un fragmento de texto listo para insertar en el
 * documento. Los bloques de partes viven en `xmlPartiesHelper` para mantener
 * este archivo por debajo del límite de líneas del proyecto.
 */
import {
  esAfectacionGratuita,
  tributoDeAfectacion,
} from './sunatCatalogsQuery';

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

/** Descuento aplicado a una línea (Catálogo 53, descuento por ítem). */
export interface DescuentoLinea {
  /** Monto del descuento, sin IGV. */
  monto: number;
  /** Código del motivo; '00' otros, '02' descuento global. */
  codigo?: string;
}

export interface LineaDetalle {
  id: number;
  descripcion: string;
  codigo?: string;
  /** `unitCode` del Catálogo 03: NIU, DZN, CEN, MIL, KGM, MTR, BG, BX. */
  unidad?: string;
  cantidad: number;
  valorUnitario: number;
  precioUnitario?: number;
  /** Código del Catálogo 07: 10, 20, 30, 40, 11-16, 21, 31-36. */
  afectacion: string;
  totalLinea: number;
  igvLinea: number;
  /** Descuentos de la línea (se restan del valor de venta). */
  descuentos?: DescuentoLinea[];
  /**
   * Tributo 7152 del ICBPER (TA-62). Va en la MISMA línea solo cuando la línea
   * ES la bolsa plástica; el ICBPER total del comprobante se declara aparte en
   * su propio `TaxTotal`.
   */
  icbperLinea?: number;
}

/** Nombres del Catálogo 05 para el `TaxScheme` de la línea. */
const NOMBRE_TRIBUTO: Record<string, { nombre: string; tipo: string }> = {
  '1000': { nombre: 'IGV', tipo: 'VAT' },
  '9995': { nombre: 'EXP', tipo: 'FRE' },
  '9996': { nombre: 'GRA', tipo: 'FRE' },
  '9997': { nombre: 'EXO', tipo: 'VAT' },
  '9998': { nombre: 'INA', tipo: 'FRE' },
  '7152': { nombre: 'ICBPER', tipo: 'OTH' },
};

/**
 * `cac:AllowanceCharge` de un descuento de línea.
 *
 * `ChargeIndicator` es `false` porque es un descuento, no un cargo. El
 * `AllowanceChargeReasonCode` toma el código del Catálogo 53 y la base es el
 * valor de venta de la línea.
 */
const bloqueDescuentoLinea = (
  d: DescuentoLinea,
  base: number,
  moneda: string,
): string => `    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReasonCode>${esc(d.codigo ?? '00')}</cbc:AllowanceChargeReasonCode>
      <cbc:Amount currencyID="${moneda}">${dinero(d.monto)}</cbc:Amount>
      <cac:BaseAmount currencyID="${moneda}">${dinero(base)}</cac:BaseAmount>
    </cac:AllowanceCharge>`;

/**
 * `cac:TaxCategory` de la línea según su afectación.
 *
 * La `TaxCategory/ID` usa el código UN/ECE 5305: `S` estándar (gravado), `E`
 * exonerado, `O` fuera del ámbito (inafecto), `G` exportación.
 */
const categoriaLinea = (afectacion: string, tributo: string): string => {
  const nombre = NOMBRE_TRIBUTO[tributo] ?? NOMBRE_TRIBUTO['1000'];

  // El Percent solo tiene sentido en los gravados; en exonerado/inafecto
  // SUNAT lo omite y declararlo con 18.00 se lee como un IGV mal calculado.
  const porcentaje =
    tributo === '1000' ? '\n          <cbc:Percent>18.00</cbc:Percent>' : '';

  // La razón de exoneración es el código del Catálogo 07. En las gratuitas
  // además se declara PriceTypeCode en el PricingReference, no aquí.
  const razon = `\n          <cbc:TaxExemptionReasonCode>${esc(afectacion)}</cbc:TaxExemptionReasonCode>`;

  const idCategoria =
    tributo === '1000' ? 'S' : tributo === '9997' ? 'E' : tributo === '9995' ? 'G' : 'O';

  return `        <cac:TaxCategory>
          <cbc:ID schemeID="UN/ECE 5305">${idCategoria}</cbc:ID>${porcentaje}${razon}
          <cac:TaxScheme>
            <cbc:ID>${tributo}</cbc:ID>
            <cbc:Name>${nombre.nombre}</cbc:Name>
            <cbc:TaxTypeCode>${nombre.tipo}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>`;
};

/**
 * Bloque `<cac:InvoiceLine>` del detalle.
 *
 * Cambios de TA-62 frente a la versión anterior, que asumía que todas las
 * líneas estaban gravadas:
 *
 *  - El `TaxScheme/ID` depende de la afectación (`1000`, `9995`, `9997`,
 *    `9998`). Antes TODA línea declaraba IGV aunque fuera exonerada.
 *  - Las gratuitas llevan `PriceAmount = 0`, `PriceTypeCode = '02'` y el
 *    `LineExtensionAmount` en 0.00 (regla XSL 3278). Declararlas con importe
 *    infla la base imponible del comprobante.
 *  - Admite `cac:AllowanceCharge` por línea.
 *  - La bolsa plástica añade el tributo 7152 en su propia línea.
 */
export const bloqueLinea = (l: LineaDetalle, moneda: string): string => {
  const unidad = l.unidad ?? 'NIU';
  const precio = l.precioUnitario ?? l.valorUnitario * 1.18;
  const gratuita = esAfectacionGratuita(l.afectacion);
  const tributo = tributoDeAfectacion(l.afectacion) ?? '1000';

  // Base de la línea sin IGV, ya con los descuentos aplicados.
  const descuentos = l.descuentos ?? [];
  const totalDescuentos = descuentos.reduce((suma, d) => suma + d.monto, 0);
  const baseBruta = l.totalLinea - l.igvLinea;
  const neto = gratuita ? 0 : baseBruta - totalDescuentos;

  // Regla 3278: la gratuita se declara a precio cero con tipo '02'.
  const precioXml = gratuita ? 0 : precio;
  const tipoPrecio = gratuita ? '02' : '01';

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

  const descuentosXml = descuentos
    .map((d) => bloqueDescuentoLinea(d, baseBruta, moneda))
    .join('\n');

  // ICBPER: solo la línea de la bolsa lleva su propio TaxSubtotal con 7152.
  const icbperXml =
    (l.icbperLinea ?? 0) > 0
      ? `
      <cac:TaxSubtotal>
        <cbc:TaxAmount currencyID="${moneda}">${dinero(l.icbperLinea ?? 0)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID schemeID="UN/ECE 5305">S</cbc:ID>
          <cac:TaxScheme>
            <cbc:ID>7152</cbc:ID>
            <cbc:Name>ICBPER</cbc:Name>
            <cbc:TaxTypeCode>OTH</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
      : '';

  const totalImpuestosLinea = dinero((gratuita ? 0 : l.igvLinea) + (l.icbperLinea ?? 0));

  return `  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${esc(unidad)}">${l.cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dinero(neto)}</cbc:LineExtensionAmount>
${descuentosXml ? `${descuentosXml}\n` : ''}    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${dinero(precioXml)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>${tipoPrecio}</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${totalImpuestosLinea}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${dinero(neto)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${dinero(gratuita ? 0 : l.igvLinea)}</cbc:TaxAmount>
${categoriaLinea(l.afectacion, tributo)}
      </cac:TaxSubtotal>${icbperXml}
    </cac:TaxTotal>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${dinero(gratuita ? 0 : l.valorUnitario)}</cbc:PriceAmount>
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
