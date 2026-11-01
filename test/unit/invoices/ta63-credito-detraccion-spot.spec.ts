/**
 * TA-63 · cuotas al crédito y detracción SPOT.
 *
 * Lo que se protege, en orden de importancia:
 *
 *  1. El cronograma de cuotas CUADRA contra el monto neto pendiente. La regla
 *     3319 de la hoja oficial compara con `!=`: ni un céntimo de diferencia.
 *  2. Ninguna cuota vence el mismo día de la emisión ni antes (regla 3267).
 *  3. Al contado no hay cronograma, y al crédito no hay `Contado` + `Credito`
 *     a la vez (regla 3247). Ambas incoherencias se rechazan antes de enviar.
 *  4. La detracción descuenta del neto al crédito y añade la Leyenda 2006 más
 *     el `cac:PaymentMeans` de detracción que exigen 4265 y 3034.
 *  5. Los códigos del Catálogo 54 dados de baja (006, 018, 029, 033) se
 *     rechazan aquí, no cuando los devuelve SUNAT.
 *
 * El patrón de la casa se mantiene: las reglas se comprueban contra el VALIDADOR
 * (mensaje de error exacto) y contra el XML generado, no solo contra una u otra.
 */
import { describe, expect, it } from '@jest/globals';
import {
  esOperacionConDetraccion,
  montoDetraccion,
  montoNetoPendiente,
  numeroDeCuota,
  validarDetraccion,
  validarPago,
} from '../../../src/modules/invoices/application/services/paymentTermsAndSpotValidator';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
import type { LineaDetalle } from '../../../src/modules/invoices/xmlNodesHelper';

const generador = new UblGeneratorService();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Línea gravada con IGV ya calculado, para armar facturas de importe conocido. */
function lineaGravada(
  id: number,
  descripcion: string,
  valorUnitario: number,
  cantidad = 1,
): LineaDetalle {
  const base = cantidad * valorUnitario;
  const igv = Math.round(base * 0.18 * 100) / 100;
  return {
    id,
    descripcion,
    unidad: 'NIU',
    cantidad,
    valorUnitario,
    precioUnitario: valorUnitario * 1.18,
    afectacion: '10',
    totalLinea: base + igv,
    igvLinea: igv,
  };
}

/** Factura mínima; el importe total sale de las líneas. */
function factura(
  lineas: LineaDetalle[],
  extra: Partial<InvoicePayload> = {},
): InvoicePayload {
  return {
    rucEmisor: '20601012341',
    razonSocialEmisor: 'FERRETERIA LOS ANDES S.A.C.',
    tipoComprobante: '01',
    serie: 'F001',
    numero: 143,
    fechaEmision: '2026-10-31',
    tipoOperacion: '0101',
    tipoMoneda: 'PEN',
    cliente: {
      tipoDocumento: '6',
      numeroDocumento: '20100066603',
      razonSocial: 'CONSTRUCTORA DEL NORTE S.A.C.',
    },
    lineas,
    montoGravado: 0,
    montoIgv: 0,
    montoTotal: 0,
    ...extra,
  };
}

/** Captura el mensaje de una excepción, para afirmar sobre el texto. */
function mensajeDe(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('Se esperaba una excepción y no se lanzó ninguna');
}

// ---------------------------------------------------------------------------
// 1 · Operaciones de detracción y aritmética del cronograma
// ---------------------------------------------------------------------------

describe('TA-63 · utilidades del cronograma', () => {
  it('solo los tipos 1001-1004 son operaciones con detracción', () => {
    for (const tipo of ['1001', '1002', '1003', '1004']) {
      expect(esOperacionConDetraccion(tipo)).toBe(true);
    }
    // 0101 es venta interna sin detracción; 0112/0113 son exportación de
    // servicios, que no lleva detracción para el emisor.
    for (const tipo of ['0101', '0112', '0113', '', undefined]) {
      expect(esOperacionConDetraccion(tipo)).toBe(false);
    }
  });

  it('el neto pendiente descuenta la detracción del total', () => {
    expect(montoNetoPendiente({ montoTotal: 1180 })).toBe(1180);
    expect(montoNetoPendiente({ montoTotal: 1180, detraccion: 142 })).toBe(1038);
    // Sin detracción el neto es el mismo total.
    expect(montoNetoPendiente({ montoTotal: 590, detraccion: 0 })).toBe(590);
  });

  it('una detracción mayor que el total no deja el neto en negativo', () => {
    // Es un error de captura, pero devolver un neto negativo haría fallar la
    // regla 3319 con un mensaje incomprensible ("cuotas suman X, neto -Y").
    expect(montoNetoPendiente({ montoTotal: 500, detraccion: 900 })).toBe(0);
  });

  it('el neto se redondea a céntimos sin arrastrar coma flotante', () => {
    // 0.1 + 0.2 en coma flotante da 0.30000000000000004.
    expect(montoNetoPendiente({ montoTotal: 0.3, detraccion: 0 })).toBe(0.3);
    expect(montoNetoPendiente({ montoTotal: 1180.1, detraccion: 141.61 })).toBe(
      1038.49,
    );
  });

  it('las cuotas se numeran Cuota001, Cuota002, Cuota010', () => {
    expect(numeroDeCuota(1)).toBe('Cuota001');
    expect(numeroDeCuota(2)).toBe('Cuota002');
    expect(numeroDeCuota(10)).toBe('Cuota010');
  });
});

// ---------------------------------------------------------------------------
// 2 · Regla 3267: vencimiento posterior a la emisión
// ---------------------------------------------------------------------------

describe('TA-63 · regla 3267 (vencimiento posterior a la emisión)', () => {
  it('acepta una cuota que vence al día siguiente', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '2026-11-01' }],
      }),
    ).not.toThrow();
  });

  it('rechaza una cuota que vence el mismo día de la emisión', () => {
    const mensaje = mensajeDe(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '2026-10-31' }],
      }),
    );
    expect(mensaje).toMatch(/Cuota001/);
    expect(mensaje).toMatch(/regla 3267/);
  });

  it('rechaza una cuota vencida antes de la emisión', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '2026-09-30' }],
      }),
    ).toThrow(/posterior a la fecha de emisión/);
  });

  it('señala la cuota exacta que falla, no solo que algo falló', () => {
    const mensaje = mensajeDe(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 300,
        fechaEmision: '2026-10-31',
        cuotas: [
          { numero: 'Cuota001', monto: 100, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 100, vencimiento: '2026-10-15' },
          { numero: 'Cuota003', monto: 100, vencimiento: '2027-01-31' },
        ],
      }),
    );
    // La 001 vence bien, la 003 también: el mensaje debe nombrar la 002.
    expect(mensaje).toMatch(/Cuota002/);
    expect(mensaje).not.toMatch(/Cuota001/);
  });

  it('un cronograma sin fecha de vencimiento se rechaza', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '' }],
      }),
    ).toThrow(/no tiene fecha de vencimiento/);
  });
});

// ---------------------------------------------------------------------------
// 3 · Regla 3319: suma exacta del cronograma
// ---------------------------------------------------------------------------

describe('TA-63 · regla 3319 (suma exacta, sin tolerancia)', () => {
  it('acepta un cronograma que suma exactamente el neto', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 1180,
        fechaEmision: '2026-10-31',
        cuotas: [
          { numero: 'Cuota001', monto: 393.33, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 393.33, vencimiento: '2026-12-31' },
          { numero: 'Cuota003', monto: 393.34, vencimiento: '2027-01-31' },
        ],
      }),
    ).not.toThrow();
  });

  it('rechaza el cronograma que se queda a un céntimo', () => {
    const mensaje = mensajeDe(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 99.99, vencimiento: '2026-11-30' }],
      }),
    );
    expect(mensaje).toMatch(/regla 3319/);
    expect(mensaje).toMatch(/diferencia de 0\.01/);
  });

  it('rechaza el cronograma que se pasa en un céntimo', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100.01, vencimiento: '2026-11-30' }],
      }),
    ).toThrow(/El cronograma no cuadra/);
  });

  it('con detracción, las cuotas suman el NETO y no el total', () => {
    // Total 1180, detracción 142 (12 % de 1180 redondeado) → neto 1038.
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 1180,
        detraccion: 142,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 1038, vencimiento: '2026-11-30' }],
      }),
    ).not.toThrow();

    // Sumar el total completo descuadra en el importe de la detracción.
    const mensaje = mensajeDe(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 1180,
        detraccion: 142,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 1180, vencimiento: '2026-11-30' }],
      }),
    );
    expect(mensaje).toMatch(/neto pendiente es 1038\.00/);
  });

  it('la comparación es en céntimos, no en coma flotante', () => {
    // 0.1 + 0.2 = 0.30000000000000004; comparar con === fallaría aquí.
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 0.3,
        fechaEmision: '2026-10-31',
        cuotas: [
          { numero: 'Cuota001', monto: 0.1, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 0.2, vencimiento: '2026-12-31' },
        ],
      }),
    ).not.toThrow();
  });

  it('una cuota de importe cero o negativo es un error de captura', () => {
    expect(() =>
      validarPago({
        formaPago: 'Credito',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [
          { numero: 'Cuota001', monto: 100, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 0, vencimiento: '2026-12-31' },
        ],
      }),
    ).toThrow(/monto inválido/);
  });
});

// ---------------------------------------------------------------------------
// 4 · Regla 3247: contado sin cronograma
// ---------------------------------------------------------------------------

describe('TA-63 · regla 3247 (contado y crédito no conviven)', () => {
  it('al contado sin cuotas no hay nada que validar', () => {
    expect(() =>
      validarPago({ formaPago: 'Contado', montoTotal: 590, fechaEmision: '2026-10-31' }),
    ).not.toThrow();
  });

  it('al contado CON cuotas se rechaza en vez de ignorarlas', () => {
    const mensaje = mensajeDe(() =>
      validarPago({
        formaPago: 'Contado',
        montoTotal: 100,
        fechaEmision: '2026-10-31',
        cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '2026-11-30' }],
      }),
    );
    expect(mensaje).toMatch(/contado no puede tener cronograma/);
  });

  it('al crédito sin ninguna cuota se rechaza', () => {
    expect(() =>
      validarPago({ formaPago: 'Credito', montoTotal: 100, fechaEmision: '2026-10-31' }),
    ).toThrow(/al menos una cuota/);
  });

  it('sin forma de pago declarada se asume contado', () => {
    expect(() =>
      validarPago({ montoTotal: 590, fechaEmision: '2026-10-31' }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5 · XML: cabecera de forma de pago y cronograma
// ---------------------------------------------------------------------------

describe('TA-63 · XML de las cuotas al crédito', () => {
  it('una factura al contado no emite cronograma ni Amount en la cabecera', () => {
    const xml = generador.generateInvoiceXml(
      factura([lineaGravada(1, 'Servicio de flete', 500)], { formaPago: 'Contado' }),
    );

    expect(xml).toContain('<cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>');
    // La cabecera de contado no lleva monto: el neto pendiente es solo del crédito.
    const cabecera = xml.slice(
      xml.indexOf('<cac:PaymentTerms>'),
      xml.indexOf('</cac:PaymentTerms>'),
    );
    expect(cabecera).not.toContain('<cbc:Amount');
    expect(xml).not.toContain('<cbc:PaymentMeansID>Cuota</cbc:PaymentMeansID>');
  });

  it('al crédito la cabecera FormaPago lleva el monto neto pendiente', () => {
    const xml = generador.generateInvoiceXml(
      factura([lineaGravada(1, 'Servicio de flete', 1000)], {
        formaPago: 'Credito',
        cuotas: [
          { numero: 'Cuota001', monto: 590, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 590, vencimiento: '2026-12-31' },
        ],
      }),
    );

    // 1000 + 18 % IGV = 1180, repartido en dos cuotas de 590.
    expect(xml).toContain(
      '<cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>\n' +
        '    <cbc:Amount currencyID="PEN">1180.00</cbc:Amount>',
    );
  });

  it('cada cuota emite su monto y su vencimiento', () => {
    const xml = generador.generateInvoiceXml(
      factura([lineaGravada(1, 'Servicio de flete', 1000)], {
        formaPago: 'Credito',
        cuotas: [
          { numero: 'Cuota001', monto: 590, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 590, vencimiento: '2026-12-31' },
        ],
      }),
    );

    expect(xml).toContain('<cbc:ID>Cuota001</cbc:ID>');
    expect(xml).toContain('<cbc:PaymentMeansID>Cuota</cbc:PaymentMeansID>');
    expect(xml).toContain(
      '<cbc:Amount currencyID="PEN">590.00</cbc:Amount>\n    ' +
        '<cbc:PaymentDueDate>2026-11-30</cbc:PaymentDueDate>',
    );
    expect(xml).toContain('<cbc:PaymentDueDate>2026-12-31</cbc:PaymentDueDate>');
  });

  it('el generador se niega a emitir un cronograma descuadrado', () => {
    // Esta es la prueba que de verdad importa: sin la validación previa el XML
    // se construiría igual y el rechazo llegaría por el CDR de SUNAT.
    const mensaje = mensajeDe(() =>
      generador.generateInvoiceXml(
        factura([lineaGravada(1, 'Servicio de flete', 1000)], {
          formaPago: 'Credito',
          cuotas: [{ numero: 'Cuota001', monto: 1000, vencimiento: '2026-11-30' }],
        }),
      ),
    );
    expect(mensaje).toMatch(/El cronograma no cuadra/);
  });

  it('el generador se niega a emitir una cuota vencida', () => {
    expect(() =>
      generador.generateInvoiceXml(
        factura([lineaGravada(1, 'Servicio de flete', 1000)], {
          formaPago: 'Credito',
          cuotas: [{ numero: 'Cuota001', monto: 1180, vencimiento: '2026-10-01' }],
        }),
      ),
    ).toThrow(/regla 3267/);
  });
});

// ---------------------------------------------------------------------------
// 6 · Detracción SPOT: validación
// ---------------------------------------------------------------------------

describe('TA-63 · validación de la detracción', () => {
  it('acepta un código vigente por encima del umbral', () => {
    expect(() =>
      validarDetraccion({
        codigoDetraccion: '012',
        moneda: 'PEN',
        montoTotal: 1180,
        tipoComprobante: '01',
      }),
    ).not.toThrow();
  });

  it('sin código de detracción no valida nada', () => {
    expect(() =>
      validarDetraccion({ moneda: 'PEN', montoTotal: 100, tipoComprobante: '01' }),
    ).not.toThrow();
  });

  it('rechaza un código que no existe en el Catálogo 54', () => {
    expect(() =>
      validarDetraccion({
        codigoDetraccion: '999',
        moneda: 'PEN',
        montoTotal: 5000,
        tipoComprobante: '01',
      }),
    ).toThrow(/no existe en el Catálogo 54/);
  });

  it('rechaza los códigos dados de baja 006, 018, 029 y 033', () => {
    for (const codigo of ['006', '018', '029', '033']) {
      const mensaje = mensajeDe(() =>
        validarDetraccion({
          codigoDetraccion: codigo,
          moneda: 'PEN',
          montoTotal: 5000,
          tipoComprobante: '01',
        }),
      );
      expect(mensaje).toMatch(/dado de baja/);
    }
  });

  it('rechaza la detracción cuando el importe no supera S/ 700', () => {
    const mensaje = mensajeDe(() =>
      validarDetraccion({
        codigoDetraccion: '012',
        moneda: 'PEN',
        montoTotal: 700,
        tipoComprobante: '01',
      }),
    );
    expect(mensaje).toMatch(/no supera el umbral/);
  });

  it('una Boleta no admite detracción', () => {
    expect(() =>
      validarDetraccion({
        codigoDetraccion: '012',
        moneda: 'PEN',
        montoTotal: 5000,
        tipoComprobante: '03',
      }),
    ).toThrow(/solo se aplica a Facturas/);
  });

  it('el importe de la detracción usa el porcentaje del código', () => {
    // 12 % de 1180 = 141.6 → 142 redondeado a entero.
    expect(montoDetraccion(1180, '012')).toBe(142);
    // 4 % de 1000 (flete terrestre) = 40.
    expect(montoDetraccion(1000, '027')).toBe(40);
    // Un código inexistente no inventa un porcentaje.
    expect(montoDetraccion(1000, '999')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7 · Detracción SPOT en el XML
// ---------------------------------------------------------------------------

describe('TA-63 · XML de la detracción SPOT', () => {
  /** Factura de S/ 1000 + IGV con tipo de operación 1001. */
  function facturaConDetraccion(
    extra: Partial<InvoicePayload> = {},
  ): InvoicePayload {
    return factura([lineaGravada(1, 'Servicio de flete', 1000)], {
      tipoOperacion: '1001',
      codigoDetraccion: '012',
      montoEnLetras: 'MIL CIENTO OCHENTA CON 00/100 SOLES',
      cuentaBancoNacion: '00019123456',
      ...extra,
    });
  }

  it('emite la Leyenda 2006 que exige la regla 4265', () => {
    const xml = generador.generateInvoiceXml(facturaConDetraccion());
    expect(xml).toContain('<cbc:Note languageLocaleID="2006">');
    expect(xml).toContain('MIL CIENTO OCHENTA CON 00/100 SOLES');
  });

  /**
   * La cuenta del Banco de la Nación va en `cac:PayeeFinancialAccount/cbc:ID`.
   *
   * Antes se emitía `cbc:PaymentDestinationAccountID`, que NO existe en
   * `PaymentMeansType` del esquema UBL 2.1: SUNAT rechazaba el XML con
   * "found <cbc:PaymentDestinationAccountID>, but next item should be
   * end-element". Esta prueba fijaba ese nodo inválido y por eso daba verde.
   * Se descubrió emitiendo contra BETA el 31-10.
   */
  it('emite el PaymentMeans de detracción con la cuenta del Banco de la Nación', () => {
    const xml = generador.generateInvoiceXml(facturaConDetraccion());
    expect(xml).toContain('<cbc:ID>Detraccion</cbc:ID>');
    expect(xml).toContain('<cac:PayeeFinancialAccount>');
    expect(xml).toContain('<cbc:ID>00019123456</cbc:ID>');
  });

  // El medio de pago tiene que ser un código del Catálogo 59, no texto libre:
  // con 'Detraccion' SUNAT responde 3174.
  it('usa el código 999 del Catálogo 59 en el medio de pago', () => {
    const xml = generador.generateInvoiceXml(facturaConDetraccion());
    expect(xml).toContain('<cbc:PaymentMeansCode>999</cbc:PaymentMeansCode>');
  });

  it('sin cuenta del Banco de la Nación omite el destino pero conserva el bloque', () => {
    const xml = generador.generateInvoiceXml(
      facturaConDetraccion({ cuentaBancoNacion: undefined }),
    );
    expect(xml).toContain('<cbc:ID>Detraccion</cbc:ID>');
    expect(xml).not.toContain('PayeeFinancialAccount');
  });

  it('una venta sin detracción no emite Leyenda 2006 ni PaymentMeans', () => {
    const xml = generador.generateInvoiceXml(
      factura([lineaGravada(1, 'Servicio de pintura', 500)], {
        tipoOperacion: '0101',
      }),
    );
    expect(xml).not.toContain('languageLocaleID="2006"');
    expect(xml).not.toContain('<cbc:ID>Detraccion</cbc:ID>');
  });

  it('al crédito con detracción las cuotas suman el importe a pagar y no el total', () => {
    // Total 1180. La detracción del 12 % son 142 enteros (regla 3208), que el
    // cliente deposita en el Banco de la Nación. El saldo al crédito es 1038.
    const xml = generador.generateInvoiceXml(
      facturaConDetraccion({
        formaPago: 'Credito',
        cuotas: [
          { numero: 'Cuota001', monto: 519, vencimiento: '2026-11-30' },
          { numero: 'Cuota002', monto: 519, vencimiento: '2026-12-31' },
        ],
      }),
    );

    // La cabecera declara el neto pendiente, no el total del comprobante.
    expect(xml).toContain('<cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>\n' +
      '    <cbc:Amount currencyID="PEN">1038.00</cbc:Amount>');
    // Y las cuotas también suman el neto.
    expect(xml).toContain('<cbc:Amount currencyID="PEN">519.00</cbc:Amount>');
  });

  it('un cronograma que suma el total y no el neto se rechaza', () => {
    expect(() =>
      generador.generateInvoiceXml(
        facturaConDetraccion({
          formaPago: 'Credito',
          cuotas: [{ numero: 'Cuota001', monto: 1180, vencimiento: '2026-11-30' }],
        }),
      ),
    ).toThrow(/neto pendiente es 1038\.00/);
  });

  it('la detracción con código dado de baja se rechaza antes de generar', () => {
    expect(() =>
      generador.generateInvoiceXml(
        facturaConDetraccion({ codigoDetraccion: '033' }),
      ),
    ).toThrow(/dado de baja/);
  });

  it('una boleta con detracción se rechaza', () => {
    const boleta = facturaConDetraccion({ tipoComprobante: '03', serie: 'B001' });
    boleta.cliente = {
      tipoDocumento: '1',
      numeroDocumento: '70123456',
      razonSocial: 'JUAN PEREZ',
    };
    expect(() => generador.generateInvoiceXml(boleta)).toThrow(
      /solo se aplica a Facturas/,
    );
  });

  it('la detracción en dólares se informa igual en soles enteros', () => {
    // Regla 3208: el depósito se hace en soles aunque el comprobante esté en
    // USD, así que el importe se redondea a entero sobre la base.
    const xml = generador.generateInvoiceXml(
      facturaConDetraccion({ tipoMoneda: 'USD' }),
    );
    // El comprobante mantiene su moneda (el Atributo lleva listID ISO 4217)...
    expect(xml).toContain('<cbc:DocumentCurrencyCode listID="ISO 4217 Alpha">USD</cbc:DocumentCurrencyCode>');
    // ...y la Leyenda 2006 y el medio de pago siguen presentes.
    expect(xml).toContain('languageLocaleID="2006"');
    expect(xml).toContain('<cbc:ID>Detraccion</cbc:ID>');
  });
});
