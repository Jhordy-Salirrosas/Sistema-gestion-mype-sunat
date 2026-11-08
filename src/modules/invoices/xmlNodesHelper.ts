import { formatoMoneda, formatoUnitario, multiplicarMoneda } from './money';
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
export const dinero = (importe: number): string => formatoMoneda(importe);

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
  cantidadBolsas?: number;
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
      <cbc:BaseAmount currencyID="${moneda}">${dinero(base)}</cbc:BaseAmount>
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
export const bloqueLinea = (
  l: LineaDetalle,
  moneda: string,
  /**
   * Raíz del documento: `Invoice`, `CreditNote` o `DebitNote`.
   *
   * El nombre del elemento de línea CAMBIA con la raíz: las notas usan
   * `cac:CreditNoteLine` / `cac:DebitNoteLine`, no `cac:InvoiceLine`. Emitir
   * siempre InvoiceLine hacía que SUNAT rechazara toda nota con
   * "found <cac:InvoiceLine>, but next item should be CreditNoteLine".
   *
   * Cambia también la etiqueta de la cantidad: una nota lleva
   * `cbc:CreditedQuantity` / `cbc:DebitedQuantity` donde la factura lleva
   * `cbc:InvoicedQuantity`. Se detectó emitiendo una NC contra BETA el 31-10.
   */
  raiz: 'Invoice' | 'CreditNote' | 'DebitNote' = 'Invoice',
): string => {
  const unidad = l.unidad ?? 'NIU';
  const precio = l.precioUnitario ?? l.valorUnitario * 1.18;
  const gratuita = esAfectacionGratuita(l.afectacion);
  const tributo = tributoDeAfectacion(l.afectacion) ?? '1000';

  // Base de la línea sin IGV, ya con los descuentos aplicados.
  const descuentos = l.descuentos ?? [];
  const baseBruta = multiplicarMoneda(l.cantidad, l.valorUnitario);
  const neto = gratuita ? 0 : l.totalLinea - l.igvLinea;

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
        <cbc:TaxAmount currencyID="${moneda}">${dinero(l.icbperLinea ?? 0)}</cbc:TaxAmount>${l.cantidadBolsas !== undefined ? `
        <cbc:BaseUnitMeasure unitCode="NIU">${l.cantidadBolsas}</cbc:BaseUnitMeasure>
        <cbc:PerUnitAmount currencyID="${moneda}">0.50</cbc:PerUnitAmount>` : ''}
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

  // ORDEN DE LOS HIJOS DE `cac:InvoiceLine` (UBL 2.1)
  //
  // El esquema es una SECUENCIA, no una lista: cada hijo tiene su posición fija.
  // Emitiendo contra SUNAT BETA apareció `cvc-particle 2.1 ... found <cac:Price>
  // ... but next item should be Item`, porque `Price` se emitía antes de `Item`.
  //
  // Secuencia verificada en el XSD oficial (InvoiceLineType, UBL 2.1):
  //   cbc:ID, cbc:InvoicedQuantity, cbc:LineExtensionAmount,
  //   Invoice: PricingReference, AllowanceCharge, TaxTotal, Item, Price.
  //   CreditNote/DebitNote: PricingReference, TaxTotal, AllowanceCharge, Item, Price.
  //
  // `cac:Item` va ANTES de `cac:Price`. Los tests comparaban fragmentos sueltos
  // y ninguno miraba el orden, así que pasaban con el XML inválido; solo se vio
  // enviando de verdad.
  return `  <cac:${raiz}Line>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:${etiquetaCantidad(raiz)} unitCode="${esc(unidad)}">${l.cantidad}</cbc:${etiquetaCantidad(raiz)}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dinero(neto)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${formatoUnitario(precioXml)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>${tipoPrecio}</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
${raiz === 'Invoice' && descuentosXml ? `${descuentosXml}\n` : ''}    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${totalImpuestosLinea}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${dinero(neto)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${dinero(gratuita ? 0 : l.igvLinea)}</cbc:TaxAmount>
${categoriaLinea(l.afectacion, tributo)}
      </cac:TaxSubtotal>${icbperXml}
    </cac:TaxTotal>
${raiz !== 'Invoice' && descuentosXml ? `${descuentosXml}\n` : ''}${item}
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${formatoUnitario(gratuita ? 0 : l.valorUnitario)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${raiz}Line>`;
};

/**
 * Etiqueta de la cantidad según la raíz del documento.
 *
 * `InvoicedQuantity` en factura/boleta; `CreditedQuantity` y `DebitedQuantity`
 * en las notas. El esquema UBL 2.1 las distingue y SUNAT valida el nombre.
 */
const etiquetaCantidad = (raiz: 'Invoice' | 'CreditNote' | 'DebitNote'): string => {
  if (raiz === 'CreditNote') return 'CreditedQuantity';
  if (raiz === 'DebitNote') return 'DebitedQuantity';
  return 'InvoicedQuantity';
};

export interface CuotaXml {
  numero: string;
  monto: number;
  vencimiento: string;
}

/**
 * Bloque `<cac:PaymentTerms>` con la forma de pago y su cronograma (TA-63).
 *
 * CAMBIO respecto de la versión anterior: el bloque `FormaPago` de una venta
 * al crédito ahora lleva `<cbc:Amount>` con el monto neto pendiente.
 *
 * Es obligatorio y no cosmético: la regla 3319 de la hoja oficial compara
 * `sum(PaymentTerms[PaymentMeansID='Credito']/Amount)` contra
 * `sum(PaymentTerms[PaymentMeansID[starts-with(.,'Cuota')]]/Amount)`. Sin el
 * `Amount` en la cabecera, el lado izquierdo de la comparación vale 0 y TODA
 * factura al crédito se rechaza, por bien que esté el cronograma.
 *
 * `montoNetoPendiente` debe venir ya calculado (total menos detracción), porque
 * este módulo formatea y no liquida.
 */
export const bloqueFormaPago = (
  formaPago: string,
  moneda: string,
  cuotas: CuotaXml[],
  montoNetoPendiente?: number,
): string => {
  const cabecera = `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>${esc(formaPago)}</cbc:PaymentMeansID>${
      montoNetoPendiente !== undefined
        ? `\n    <cbc:Amount currencyID="${moneda}">${dinero(montoNetoPendiente)}</cbc:Amount>`
        : ''
    }
  </cac:PaymentTerms>`;

  if (cuotas.length === 0) return cabecera;

  // TODOS los términos de pago llevan `cbc:ID` = "FormaPago"; lo que distingue
  // la cabecera de cada cuota es `cbc:PaymentMeansID` (Credito / Cuota001 /
  // Cuota002). Antes el `ID` de la cuota llevaba el número (`Cuota001`) y SUNAT
  // seguía rechazando la factura al crédito con la regla 3249 ("Si el tipo de
  // transacción es al Crédito debe existir al menos información de una cuota de
  // pago"): busca las cuotas como `PaymentTerms[ID='FormaPago']` y, al no
  // encontrar ninguna bajo ese ID, concluye que el cronograma no existe.
  const cronograma = cuotas
    .map(
      (c) => `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>${esc(c.numero)}</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${dinero(c.monto)}</cbc:Amount>
    <cbc:PaymentDueDate>${esc(c.vencimiento)}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`,
    )
    .join('\n');

  return `${cabecera}\n${cronograma}`;
};

/**
 * Leyenda 2006 del monto en letras para operaciones con detracción (TA-63).
 *
 * La regla 4265 la exige en cuanto el tipo de operación es 100x. Va como
 * `<cbc:Note languageLocaleID="2006">`, distinta de la Leyenda 1000 (importe
 * en letras) y de la 2000/2001, y SUNAT rechaza si aparece más de una vez con
 * el mismo `languageLocaleID` (regla 3014).
 */
export const bloqueLeyenda2006 = (montoEnLetras: string): string =>
  `  <cbc:Note languageLocaleID="2006">${esc(montoEnLetras)}</cbc:Note>`;

/**
 * `cac:PaymentMeans` de la detracción (TA-63).
 *
 * Tres cosas que SUNAT exige y que costaron un rechazo cada una al emitir
 * contra BETA el 31-10:
 *
 *  1. `cbc:PaymentMeansCode` NO puede ser texto libre: es un código del
 *     Catálogo 59 (medio de pago) y SUNAT responde 3174 si no lo es. Para la
 *     detracción se respeta la selección validada. Sin selección se conserva
 *     `999` por compatibilidad (specs/M1-TA63-CATALOGO59-CONTRATO.md).
 *  2. La cuenta del Banco de la Nación va en
 *     `cac:PayeeFinancialAccount/cbc:ID`; `cbc:PaymentDestinationAccountID` no
 *     existe en el esquema y rompía la validación XSD.
 *  3. El `cbc:ID` sí es el texto 'Detraccion', que es el que la regla 3034 usa
 *     para identificar este medio de pago.
 */
export const bloquePaymentMeansDetraccion = (
  cuentaBancoNacion?: string,
  medioPago: import('./domain/rules/medioPagoDetraccion').MedioPagoDetraccion = '999',
): string => `  <cac:PaymentMeans>
    <cbc:ID>Detraccion</cbc:ID>
    <cbc:PaymentMeansCode>${medioPago}</cbc:PaymentMeansCode>${
      cuentaBancoNacion
        ? `\n    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(cuentaBancoNacion)}</cbc:ID>
    </cac:PayeeFinancialAccount>`
        : ''
    }
  </cac:PaymentMeans>`;

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
