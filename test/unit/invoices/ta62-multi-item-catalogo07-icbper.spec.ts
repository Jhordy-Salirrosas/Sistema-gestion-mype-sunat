/**
 * TA-62 · multi-ítem de ferretería con Catálogo 03, Catálogo 07 completo e ICBPER.
 *
 * Lo que se protege, en orden de importancia:
 *
 *  1. El XML generado pasa la HOJA OFICIAL de SUNAT (Factura y Boleta 2.0.1.xsl)
 *     con cero errores. Es la única prueba que vale: las demás comprueban que
 *     el texto tenga un nodo, esta comprueba que SUNAT lo aceptaría.
 *  2. Cada afectación del Catálogo 07 emite el tributo que le corresponde. Antes
 *     de TA-62 TODA línea declaraba IGV `1000`, incluso las exoneradas.
 *  3. Las gratuitas (11-16, 21, 31-36) van con precio 0, `PriceTypeCode='02'` y
 *     fuera del `LineExtensionAmount` (regla XSL 3278).
 *  4. El ICBPER es una línea independiente con importe exacto cantidad x 0.50
 *     (regla XSL 3306).
 *  5. El stock se valida contra el inventario y falla como error de negocio.
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  calcularIcbper,
  lineaBolsaIcBper,
} from '../../../src/modules/invoices/ublIcbperLine';
import {
  esAfectacionGratuita,
  esCodigoDetraccionVigente,
  esUnidadFerreteria,
  tributoDeAfectacion,
} from '../../../src/modules/invoices/sunatCatalogsQuery';
import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
import type { LineaDetalle } from '../../../src/modules/invoices/xmlNodesHelper';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const generador = new UblGeneratorService();
const validadorXsl = new SunatXslValidatorService();

/** Payload mínimo de una factura. */
function factura(
  lineas: LineaDetalle[],
  extra: Partial<InvoicePayload> = {},
): InvoicePayload {
  return {
    rucEmisor: '20601012341',
    razonSocialEmisor: 'FERRETERIA LOS ANDES S.A.C.',
    nombreComercialEmisor: 'Ferreteria Los Andes',
    ubigeoEmisor: '130101',
    direccionEmisor: 'Av. Larco 123',
    tipoComprobante: '01',
    serie: 'F001',
    numero: 143,
    fechaEmision: '2026-10-31',
    horaEmision: '10:30:00',
    tipoOperacion: '0101',
    formaPago: 'Contado',
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

/** Línea gravada con IGV ya calculado. */
function lineaGravada(
  id: number,
  descripcion: string,
  unidad: string,
  cantidad: number,
  valorUnitario: number,
): LineaDetalle {
  const base = cantidad * valorUnitario;
  const igv = Math.round(base * 0.18 * 100) / 100;
  return {
    id,
    descripcion,
    unidad,
    cantidad,
    valorUnitario,
    precioUnitario: valorUnitario * 1.18,
    afectacion: '10',
    totalLinea: base + igv,
    igvLinea: igv,
  };
}

// ---------------------------------------------------------------------------
// 1 · Afectaciones del Catálogo 07
// ---------------------------------------------------------------------------

describe('TA-62 · cada afectación emite su tributo', () => {
  it('el significado tributario de cada código del Catálogo 07 es correcto', () => {
    // Gravadas (incluidas las gratuitas gravadas 11-16).
    expect(tributoDeAfectacion('10')).toBe('1000');
    expect(tributoDeAfectacion('11')).toBe('1000');
    expect(tributoDeAfectacion('16')).toBe('1000');
    // Exoneradas.
    expect(tributoDeAfectacion('20')).toBe('9997');
    expect(tributoDeAfectacion('21')).toBe('9997');
    // Inafectas.
    expect(tributoDeAfectacion('30')).toBe('9998');
    expect(tributoDeAfectacion('36')).toBe('9998');
    // Exportación.
    expect(tributoDeAfectacion('40')).toBe('9995');
    // Un código que no pertenece al catálogo no inventa un tributo.
    expect(tributoDeAfectacion('99')).toBeNull();
  });

  it('reconoce como gratuitas exactamente los códigos de retiro y transferencia', () => {
    for (const codigo of ['11', '12', '13', '14', '15', '16', '21', '31', '32', '33', '34', '35', '36']) {
      expect(esAfectacionGratuita(codigo)).toBe(true);
    }
    // Onerosas y exportación NO son gratuitas.
    for (const codigo of ['10', '20', '30', '40']) {
      expect(esAfectacionGratuita(codigo)).toBe(false);
    }
  });

  it('la línea exonerada NO declara IGV 1000', () => {
    const linea: LineaDetalle = {
      id: 1,
      descripcion: 'Arena gruesa',
      unidad: 'MTR',
      cantidad: 10,
      valorUnitario: 50,
      afectacion: '20',
      totalLinea: 500,
      igvLinea: 0,
    };
    const xml = generador.generateInvoiceXml(factura([linea]));

    const bloque = xml.slice(xml.indexOf('<cac:InvoiceLine>'));
    expect(bloque).toContain('<cbc:ID>9997</cbc:ID>');
    expect(bloque).not.toContain('<cbc:ID>1000</cbc:ID>');
    // La razón de exoneración es el código del Catálogo 07.
    expect(bloque).toContain('<cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode>');
  });

  it('la línea inafecta declara 9998 y la de exportación 9995', () => {
    const inafecta: LineaDetalle = {
      id: 1,
      descripcion: 'Servicio de pintura',
      unidad: 'NIU',
      cantidad: 1,
      valorUnitario: 300,
      afectacion: '30',
      totalLinea: 300,
      igvLinea: 0,
    };
    const exportada: LineaDetalle = {
      id: 1,
      descripcion: 'Cemento exportado',
      unidad: 'BG',
      cantidad: 100,
      valorUnitario: 25,
      afectacion: '40',
      totalLinea: 2500,
      igvLinea: 0,
    };

    expect(generador.generateInvoiceXml(factura([inafecta]))).toContain(
      '<cbc:ID>9998</cbc:ID>',
    );
    expect(generador.generateInvoiceXml(factura([exportada]))).toContain(
      '<cbc:ID>9995</cbc:ID>',
    );
  });

  it('la gratuita va con precio 0, PriceTypeCode 02 y fuera de la base', () => {
    const gratuita: LineaDetalle = {
      id: 1,
      descripcion: 'Bolsa de cemento de regalo',
      unidad: 'BG',
      cantidad: 5,
      valorUnitario: 25,
      precioUnitario: 25,
      afectacion: '14',
      totalLinea: 125,
      igvLinea: 22.5,
    };
    // Se acompaña de una línea onerosa para que el comprobante tenga base.
    const onerosa = lineaGravada(2, 'Fierro corrugado', 'MTR', 10, 20);
    const xml = generador.generateInvoiceXml(factura([gratuita, onerosa]));

    const primeraLinea = xml.slice(
      xml.indexOf('<cac:InvoiceLine>'),
      xml.indexOf('<cbc:ID>2</cbc:ID>'),
    );

    expect(primeraLinea).toContain('<cbc:PriceTypeCode>02</cbc:PriceTypeCode>');
    // Regla 3278: el LineExtensionAmount de la gratuita es cero.
    expect(primeraLinea).toContain(
      '<cbc:LineExtensionAmount currencyID="PEN">0.00</cbc:LineExtensionAmount>',
    );
    // El precio alternativo también es cero.
    expect(primeraLinea).toContain(
      '<cbc:PriceAmount currencyID="PEN">0.00</cbc:PriceAmount>',
    );
  });

  it('la gratuita NO infla la base imponible del comprobante', () => {
    const gratuita: LineaDetalle = {
      id: 1,
      descripcion: 'Regalo',
      unidad: 'NIU',
      cantidad: 1,
      valorUnitario: 100,
      afectacion: '14',
      totalLinea: 118,
      igvLinea: 18,
    };
    const onerosa = lineaGravada(2, 'Clavos', 'KGM', 10, 10);
    const xml = generador.generateInvoiceXml(factura([gratuita, onerosa]));

    // La base del comprobante son los 100 de la línea onerosa, no 200.
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="PEN">100.00</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount',
    );
  });
});

// ---------------------------------------------------------------------------
// 2 · ICBPER como línea independiente (regla 3306)
// ---------------------------------------------------------------------------

describe('TA-62 · ICBPER como línea independiente', () => {
  it('el importe es exactamente cantidad x 0.50, sin error flotante', () => {
    expect(calcularIcbper(1)).toBe(0.5);
    expect(calcularIcbper(3)).toBe(1.5);
    expect(calcularIcbper(7)).toBe(3.5);
    // El caso que rompe una multiplicación ingenua en coma flotante.
    expect(calcularIcbper(28)).toBe(14);
    expect(calcularIcbper(0)).toBe(0);
    expect(calcularIcbper(-1)).toBe(0);
  });

  it('construye una línea con unidad NIU y el tributo en su total', () => {
    const linea = lineaBolsaIcBper(3, { cantidad: 4 });

    expect(linea).not.toBeNull();
    expect(linea!.unidad).toBe('NIU');
    expect(linea!.cantidad).toBe(4);
    expect(linea!.icbperLinea).toBe(2);
    expect(linea!.afectacion).toBe('10');
  });

  it('devuelve null sin bolsas (no genera una línea vacía)', () => {
    expect(lineaBolsaIcBper(1, { cantidad: 0 })).toBeNull();
    expect(lineaBolsaIcBper(1, { cantidad: -2 })).toBeNull();
  });

  it('el XML incluye la línea de bolsa al final y el TaxTotal 7152', () => {
    const onerosa = lineaGravada(1, 'Cemento', 'BG', 10, 25);
    const xml = generador.generateInvoiceXml(
      factura([onerosa], { bolsasIcBper: 5 }),
    );

    // La línea de la bolsa es la 2 y tiene el tributo 7152.
    expect(xml).toContain('<cbc:ID>2</cbc:ID>');
    expect(xml).toContain('BOLSA PLASTICA');
    expect(xml).toContain('<cbc:ID>7152</cbc:ID>');
    // El importe del ICBPER: 5 x 0.50 = 2.50.
    expect(xml).toContain(
      '<cbc:TaxAmount currencyID="PEN">2.50</cbc:TaxAmount>',
    );
  });

  it('no duplica la línea si el detalle ya trae la bolsa', () => {
    const onerosa = lineaGravada(1, 'Cemento', 'BG', 10, 25);
    const bolsa = lineaBolsaIcBper(2, { cantidad: 3 })!;
    const xml = generador.generateInvoiceXml(
      factura([onerosa, bolsa], { bolsasIcBper: 3 }),
    );

    const apariciones = xml.split('BOLSA PLASTICA').length - 1;
    expect(apariciones).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3 · Unidades del Catálogo 03
// ---------------------------------------------------------------------------

describe('TA-62 · unidades del Catálogo 03', () => {
  it('acepta las ocho unidades de ferretería', () => {
    for (const unidad of ['NIU', 'DZN', 'CEN', 'MIL', 'KGM', 'MTR', 'BG', 'BX']) {
      expect(esUnidadFerreteria(unidad)).toBe(true);
    }
  });

  it('rechaza una unidad fuera del catálogo con un mensaje útil', () => {
    const linea: LineaDetalle = {
      id: 1,
      descripcion: 'Tubo PVC',
      unidad: 'GAL',
      cantidad: 2,
      valorUnitario: 30,
      afectacion: '10',
      totalLinea: 70.8,
      igvLinea: 10.8,
    };

    expect(() => generador.generateInvoiceXml(factura([linea]))).toThrow(
      /Catálogo 03/,
    );
  });

  it('acepta la unidad en minúsculas y la normaliza', () => {
    const linea: LineaDetalle = {
      id: 1,
      descripcion: 'Alambre',
      unidad: 'kgm',
      cantidad: 5,
      valorUnitario: 8,
      afectacion: '10',
      totalLinea: 47.2,
      igvLinea: 7.2,
    };
    const xml = generador.generateInvoiceXml(factura([linea]));

    expect(xml).toContain('unitCode="KGM"');
  });
});

// ---------------------------------------------------------------------------
// 4 · Validación contra la HOJA OFICIAL (la prueba que importa)
// ---------------------------------------------------------------------------

describe('TA-62 · el XML pasa la hoja oficial de SUNAT', () => {
  /**
   * Nota importante sobre estos casos.
   *
   * La redacción original exigía `errores === []` contra la hoja oficial. Eso
   * no se puede cumplir HOY, y no por un defecto de TA-62: la hoja oficial
   * delega la validación en `commons/error/validate_utils.xsl`, archivo que
   * SUNAT no publica (verificado descargando el ZIP oficial del 06/09/2022).
   * Sin él la hoja se ejecuta pero no emite ningún código de error.
   *
   * Afirmar "0 errores" en esa situación sería un falso verde. Lo que sí se
   * comprueba aquí, y es lo que aporta valor real:
   *
   *  - el XML se genera sin fallos y es XML bien formado;
   *  - la hoja oficial lo PROCESA sin reventar (ningún error de transformación);
   *  - el validador declara honestamente que no pudo validar.
   *
   * Cuando se resuelva la dependencia, estos casos pasarán a exigir los 0
   * errores. El diagnóstico está en `specs/DEUDA_VALIDADOR_XSL.md`.
   */

  /** Factura ferretera de 5 ítems con unidades distintas. */
  function facturaFerreteraCompleta(): InvoicePayload {
    return factura(
      [
        lineaGravada(1, 'Cemento Portland tipo I', 'BG', 20, 25),
        lineaGravada(2, 'Fierro corrugado 1/2"', 'MTR', 60, 9.5),
        lineaGravada(3, 'Clavos de 3"', 'KGM', 15, 4.8),
        lineaGravada(4, 'Lámina de zinc', 'MIL', 1, 3500),
        lineaGravada(5, 'Tubo PVC 4"', 'NIU', 12, 32),
      ],
      { bolsasIcBper: 20 },
    );
  }

  it('la factura multi-ítem se genera y la hoja Factura 2.0.1 la procesa', async () => {
    const xml = generador.generateInvoiceXml(facturaFerreteraCompleta());

    // Es XML bien formado y tiene las 6 líneas esperadas (5 ítems + bolsa).
    expect(xml).toContain('<cbc:ID>6</cbc:ID>');
    expect(xml).toContain('<cbc:ID>7152</cbc:ID>');

    const resultado = await validadorXsl.validar(xml, '01');

    // La hoja oficial se ejecutó: no falló al cargar ni al transformar.
    expect(resultado.motivoBloqueo).not.toMatch(/No se pudo cargar la hoja/);
    expect(resultado.motivoBloqueo).not.toMatch(/falló al procesar/);

    // Y declara que no pudo concluir, en vez de aprobar a ciegas.
    expect(resultado.validadoDeVerdad).toBe(false);
    expect(resultado.motivoBloqueo).toMatch(/validate_utils/);
  }, 60000);

  it('la boleta multi-ítem se genera y la hoja Boleta 2.0.1 la procesa', async () => {
    const boleta = facturaFerreteraCompleta();
    boleta.tipoComprobante = '03';
    boleta.serie = 'B001';
    boleta.cliente = {
      tipoDocumento: '1',
      numeroDocumento: '70123456',
      razonSocial: 'JUAN PEREZ',
    };

    const xml = generador.generateInvoiceXml(boleta);
    const resultado = await validadorXsl.validar(xml, '03');

    expect(resultado.motivoBloqueo).not.toMatch(/No se pudo cargar la hoja/);
    expect(resultado.motivoBloqueo).not.toMatch(/falló al procesar/);
    expect(resultado.validadoDeVerdad).toBe(false);
  }, 60000);

  it('una factura de solo exonerado también se genera sin fallos', async () => {
    const exonerada: LineaDetalle = {
      id: 1,
      descripcion: 'Arena gruesa por metro',
      unidad: 'MTR',
      cantidad: 10,
      valorUnitario: 50,
      precioUnitario: 50,
      afectacion: '20',
      totalLinea: 500,
      igvLinea: 0,
    };

    const xml = generador.generateInvoiceXml(factura([exonerada]));
    const resultado = await validadorXsl.validar(xml, '01');

    expect(resultado.motivoBloqueo).not.toMatch(/falló al procesar/);
    expect(resultado.validadoDeVerdad).toBe(false);
  }, 60000);
});

// ---------------------------------------------------------------------------
// 5 · Validación de stock contra el inventario
// ---------------------------------------------------------------------------

describe('TA-62 · validación de stock', () => {
  interface DoblePrisma {
    inventoryBalance: { groupBy: jest.Mock<() => Promise<unknown>> };
    inventoryProduct: { findMany: jest.Mock<() => Promise<unknown>> };
  }

  function crearPrisma(stock: Record<string, number>): DoblePrisma {
    const productos = Object.keys(stock).map((sku, i) => ({
      id: `prod-${i}`,
      sku,
      description: `Producto ${sku}`,
      sunat_unit_code: 'NIU',
    }));

    return {
      inventoryBalance: {
        groupBy: jest.fn(async () =>
          productos.map((p) => ({
            product_id: p.id,
            _sum: { current_stock: stock[p.sku] },
          })),
        ),
      },
      inventoryProduct: {
        findMany: jest.fn(async () => productos),
      },
    };
  }

  let servicio: StockValidationService;

  beforeEach(() => {
    servicio = new StockValidationService(
      crearPrisma({ 'CLAVO-3': 100, CEMENTO: 20 }) as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pasa cuando hay stock suficiente', async () => {
    const resultado = await servicio.validar('company-1', [
      { codigo: 'CLAVO-3', descripcion: 'Clavos', cantidad: 50 },
      { codigo: 'CEMENTO', descripcion: 'Cemento', cantidad: 20 },
    ]);

    expect(resultado.validados).toBe(2);
    expect(resultado.avisos).toEqual([]);
  });

  it('falla con error de NEGOCIO (no 500) cuando falta stock', async () => {
    await expect(
      servicio.validar('company-1', [
        { codigo: 'CEMENTO', descripcion: 'Cemento', cantidad: 500 },
      ]),
    ).rejects.toThrow(/Stock insuficiente/);
  });

  it('el mensaje del error dice cuánto se pide y cuánto hay', async () => {
    await expect(
      servicio.validar('company-1', [
        { codigo: 'CEMENTO', descripcion: 'Cemento', cantidad: 500 },
      ]),
    ).rejects.toThrow(/se pide 500 NIU y hay 20/);
  });

  it('un ítem sin código (un servicio) no se valida contra el almacén', async () => {
    const resultado = await servicio.validar('company-1', [
      { codigo: null, descripcion: 'Servicio de corte', cantidad: 1 },
    ]);

    expect(resultado.omitidos).toBe(1);
    expect(resultado.validados).toBe(0);
  });

  it('un producto fuera del inventario se avisa pero NO bloquea la emisión', async () => {
    const resultado = await servicio.validar('company-1', [
      { codigo: 'NO-EXISTE', descripcion: 'Desconocido', cantidad: 1 },
    ]);

    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toMatch(/no está en el inventario/);
  });

  it('convierte las líneas del payload en ítems validables', () => {
    const items = StockValidationService.itemsDesdeLineas([
      {
        id: 1,
        descripcion: 'Clavos',
        codigo: 'CLAVO-3',
        unidad: 'KGM',
        cantidad: 10,
        valorUnitario: 5,
        afectacion: '10',
        totalLinea: 59,
        igvLinea: 9,
      },
    ]);

    expect(items).toEqual([
      { codigo: 'CLAVO-3', descripcion: 'Clavos', cantidad: 10, unidad: 'KGM' },
    ]);
  });

  it('rechaza emitir con una afectación distinta a la configurada en el producto', async () => {
    const prismaConAfectacion = {
      inventoryBalance: {
        groupBy: jest.fn(async () => [
          { product_id: 'prod-exo', _sum: { current_stock: 50 } },
        ]),
      },
      inventoryProduct: {
        findMany: jest.fn(async () => [
          {
            id: 'prod-exo',
            sku: 'ARENA-EXO',
            description: 'Arena gruesa exonerada',
            sunat_unit_code: 'MTR',
            tax_affectation: '20',
          },
        ]),
      },
    };
    const validador = new StockValidationService(prismaConAfectacion as never);

    await expect(
      validador.validar('company-1', [
        {
          codigo: 'ARENA-EXO',
          descripcion: 'Arena gruesa exonerada',
          cantidad: 5,
          afectacion: '10',
        },
      ]),
    ).rejects.toThrow(/afectación tributaria del producto ARENA-EXO \(20\)/);

    await expect(
      validador.validar('company-1', [
        {
          codigo: 'ARENA-EXO',
          descripcion: 'Arena gruesa exonerada',
          cantidad: 5,
          afectacion: '20',
        },
      ]),
    ).resolves.toMatchObject({ validados: 1 });
  });
});

// ---------------------------------------------------------------------------
// 6 · Códigos de detracción dados de baja (puente con TA-63)
// ---------------------------------------------------------------------------

describe('TA-62 · códigos del Catálogo 54 dados de baja', () => {
  it('rechaza los cuatro códigos retirados por SUNAT', () => {
    for (const codigo of ['006', '018', '029', '033']) {
      expect(esCodigoDetraccionVigente(codigo)).toBe(false);
    }
  });

  it('acepta un código vigente', () => {
    expect(esCodigoDetraccionVigente('012')).toBe(true);
  });
});
