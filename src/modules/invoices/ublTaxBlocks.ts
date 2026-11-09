import { redondearMoneda } from './money';
/**
 * Bloques tributarios y totales del XML UBL 2.1 (M1).
 *
 * Genera los nodos `TaxTotal` de IGV, exonerado, inafecto, exportación e
 * ICBPER, los `PaymentTerms` de la detracción y la retención, y el
 * `LegalMonetaryTotal`. Se separa de `ublTotalesHelper` para que ese archivo
 * solo calcule los importes.
 */
import { dinero } from './xmlNodesHelper';
import type { TotalesCalculados } from './ublTotalesHelper';

/** Un subtotal con su tributo del Catálogo 05. */
interface SubtotalTributo {
  /** Código del Catálogo 05: 1000, 9995, 9996, 9997, 9998. */
  codigo: string;
  nombre: string;
  tipo: string;
  /** Categoría UN/ECE 5305. */
  categoria: string;
  base: number;
  importe: number;
  porcentaje?: number;
}

/**
 * Bloques `TaxTotal` del IGV y del ICBPER.
 *
 * Con TA-62 este bloque cubre las cinco naturalezas tributarias. Antes se
 * declaraba un único `TaxTotal` de IGV con TODA la base, así que una factura
 * con productos exonerados los sumaba a la base imponible del IGV y SUNAT la
 * observaba: el importe tributario no cuadraba con el detalle.
 *
 * Orden de los subtotales: gravado, exportación, exonerado, inafecto. SUNAT
 * acepta cualquier orden, pero el que usa un contador para leer el XML es este.
 */
export const bloqueImpuestos = (
  t: TotalesCalculados,
  moneda: string,
  tasa: number,
): string[] => {
  const subtotales: SubtotalTributo[] = [];

  if (t.gravado > 0) {
    subtotales.push({
      codigo: '1000',
      nombre: 'IGV',
      tipo: 'VAT',
      categoria: 'S',
      base: t.gravado,
      importe: t.igv,
      porcentaje: tasa * 100,
    });
  }

  if (t.exportado > 0) {
    subtotales.push({
      codigo: '9995',
      nombre: 'EXP',
      tipo: 'FRE',
      categoria: 'G',
      base: t.exportado,
      importe: 0,
    });
  }

  if (t.exonerado > 0) {
    subtotales.push({
      codigo: '9997',
      nombre: 'EXO',
      tipo: 'VAT',
      categoria: 'E',
      base: t.exonerado,
      importe: 0,
    });
  }

  if (t.inafecto > 0) {
    subtotales.push({
      codigo: '9998',
      nombre: 'INA',
      tipo: 'FRE',
      categoria: 'O',
      base: t.inafecto,
      importe: 0,
    });
  }

  // Un comprobante de puro exonerado no lleva IGV: se emite igual el TaxTotal
  // del tributo que corresponda para que la hoja oficial vea la declaración.
  if (subtotales.length === 0) {
    subtotales.push({
      codigo: '1000',
      nombre: 'IGV',
      tipo: 'VAT',
      categoria: 'S',
      base: 0,
      importe: 0,
      porcentaje: tasa * 100,
    });
  }

  const totalTributos =
    t.igv;

  const partes: string[] = [
    `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${dinero(totalTributos)}</cbc:TaxAmount>
${subtotales
  .map(
    (s) => `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${dinero(s.base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${dinero(s.importe)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305">${s.categoria}</cbc:ID>${
          s.porcentaje !== undefined
            ? `\n        <cbc:Percent>${s.porcentaje.toFixed(2)}</cbc:Percent>`
            : ''
        }
        <cac:TaxScheme>
          <cbc:ID>${s.codigo}</cbc:ID>
          <cbc:Name>${s.nombre}</cbc:Name>
          <cbc:TaxTypeCode>${s.tipo}</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
  )
  .join('\n')}
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
  codigoDetraccion?: string,
): string[] => {
  const partes: string[] = [];

  if (t.detraccion > 0) {
    // `cbc:PaymentMeansID` va el CÓDIGO DEL CATÁLOGO 54 (012, 037...), no la
    // palabra "Detraccion": SUNAT rechaza con 3033 "Valor no se encuentra en el
    // catalogo: 54". El texto 'Detraccion' es el valor de `cbc:ID`.
    //
    // Si no llega el código se omite el bloque en lugar de inventar uno: sin
    // código del catálogo la detracción no es declarable.
    const codigo = codigoDetraccion?.trim();
    if (codigo) {
      partes.push(`  <cac:PaymentTerms>
    <cbc:ID>Detraccion</cbc:ID>
    <cbc:PaymentMeansID>${codigo}</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${dinero(t.detraccion)}</cbc:Amount>
  </cac:PaymentTerms>`);
    }
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

/**
 * Bloque `LegalMonetaryTotal` con el importe a pagar ya liquidado.
 *
 * Corrección de TA-62: la versión anterior calculaba el total como
 * `gravado + igv`, ignorando por completo las líneas exoneradas, inafectas y
 * de exportación. Una factura de solo productos exonerados salía con total
 * cero aunque hubiera importe que cobrar, y las gratuitas se sumaban a una
 * base imponible que no existe.
 *
 * `LineExtensionAmount` es la suma de los valores de venta SIN impuestos de
 * todas las líneas onerosas; las gratuitas aportan 0 por la regla 3278.
 *
 * `PayableAmount` ES EL TOTAL CON IGV, SIN DESCONTAR LA DETRACCIÓN.
 *
 * La versión anterior ponía `importePagar` (total − detracción − retención), y
 * SUNAT lo rechaza con el código 3280: "El importe total del comprobante no
 * coincide con el valor calculado". El importe a pagar al proveedor es un dato
 * informativo que viaja en el `cac:PaymentTerms` de detracción; el total del
 * comprobante sigue siendo base + IGV. Se detectó emitiendo contra BETA.
 */
export const bloqueTotales = (
  t: TotalesCalculados,
  moneda: string,
): string => {
  const base =
    redondearMoneda(t.gravado + t.exonerado + t.inafecto + t.exportado);
  const totalConIgv = redondearMoneda(base + t.igv + t.icbper);

  return `  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dinero(base)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${moneda}">${dinero(base)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${dinero(totalConIgv)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${moneda}">${dinero(t.otrosDescuentos ?? 0)}</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="${moneda}">0.00</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="${moneda}">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${moneda}">${dinero(totalConIgv - (t.otrosDescuentos ?? 0))}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;
};
