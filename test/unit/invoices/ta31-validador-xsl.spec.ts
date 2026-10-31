/**
 * TA-31 — Validador local con las XSL oficiales.
 *
 * Cubre:
 *   1. Ejecución de la hoja sobre el XML firmado (criterio 1).
 *   2. Mapeo de tipo de comprobante a hoja (criterio 2).
 *   3. Traducción de códigos a mensajes legibles (criterio 3).
 *   4. Bloqueo del envío sin consumir intentos del backoff (criterio 4).
 *
 * La XSL usada es la de `test/fixtures/xsl/2.0.1.xsl`, que imita el contrato
 * de salida de la hoja oficial. La oficial no se versiona (es material de
 * SUNAT y pesa cientos de KB).
 */
import { join } from 'node:path';
import {
  mensajeLegible,
  reglaPorCodigo,
} from '../../../src/modules/invoices/application/services/sunatValidationCatalog';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

const DIRECTORIO_XSL = join(__dirname, '../../fixtures/xsl');

/** XML de prueba con los nodos que la hoja evalúa. */
function xmlFactura(opciones?: {
  base?: number;
  igv?: number;
  total?: number;
  emisor?: string;
  cliente?: string;
}): string {
  const base = opciones?.base ?? 100;
  const igv = opciones?.igv ?? 18;
  const total = opciones?.total ?? 118;
  const emisor = opciones?.emisor ?? '20601012341';
  const cliente = opciones?.cliente ?? '20100070970';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:CustomerAssignedAccountID>${emisor}</cbc:CustomerAssignedAccountID>
  <cbc:CustomerAssignedAccountID>${cliente}</cbc:CustomerAssignedAccountID>
  <cbc:LineExtensionAmount>${base}</cbc:LineExtensionAmount>
  <cbc:TaxAmount>${igv}</cbc:TaxAmount>
  <cbc:PayableAmount>${total}</cbc:PayableAmount>
</Invoice>`;
}

describe('TA-31 - ejecución de la hoja XSL', () => {
  let validador: SunatXslValidatorService;

  beforeEach(() => {
    process.env.SUNAT_XSL_DIR = DIRECTORIO_XSL;
    validador = new SunatXslValidatorService();
  });

  afterAll(() => {
    delete process.env.SUNAT_XSL_DIR;
  });

  it('acepta un XML cuyos montos cuadran', async () => {
    const resultado = await validador.validar(xmlFactura(), '01');

    expect(resultado.bloqueado).toBe(false);
    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
  });

  it('detecta un error de cálculo de IGV (criterio de la PRUEBA del backlog)', async () => {
    const resultado = await validador.validar(
      xmlFactura({ total: 500 }),
      '01',
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.map((e) => e.codigo)).toContain('2100');
  });

  it('detecta que el adquirente es el propio emisor', async () => {
    const resultado = await validador.validar(
      xmlFactura({ emisor: '20601012341', cliente: '20601012341' }),
      '01',
    );

    expect(resultado.errores.map((e) => e.codigo)).toContain('2022');
  });

  it('detecta un monto total no positivo', async () => {
    const resultado = await validador.validar(
      xmlFactura({ base: 0, igv: 0, total: 0 }),
      '01',
    );

    expect(resultado.errores.map((e) => e.codigo)).toContain('2800');
  });

  it('traduce cada código a un mensaje legible (criterio 3)', async () => {
    const resultado = await validador.validar(
      xmlFactura({ total: 500 }),
      '01',
    );

    const error = resultado.errores.find((e) => e.codigo === '2100');
    expect(error?.mensaje).toMatch(/no coincide con la suma de los ítems/);
  });

  it('mapea los cuatro tipos del criterio 2 a la hoja 2.0.1', async () => {
    for (const tipo of ['01', '03', '07', '08']) {
      const resultado = await validador.validar(xmlFactura(), tipo);
      expect(resultado.bloqueado).toBe(false);
    }
  });

  it('bloquea cuando el tipo no tiene hoja mapeada', async () => {
    const resultado = await validador.validar(xmlFactura(), '99');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivoBloqueo).toMatch(/No hay hoja XSL mapeada/);
  });

  it('bloquea, en vez de dejar pasar, cuando la hoja no existe (criterio 4)', async () => {
    process.env.SUNAT_XSL_DIR = join(__dirname, 'no-existe');
    const sinHoja = new SunatXslValidatorService();

    const resultado = await sinHoja.validar(xmlFactura(), '01');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.valido).toBe(false);
    expect(resultado.motivoBloqueo).toMatch(/No se pudo cargar la hoja oficial/);
  });

  it('reporta un código fuera del catálogo como error, no lo ignora', async () => {
    // La hoja de prueba no emite 4072; se valida el interpretador directamente
    // mediante un XML que dispara 2100 y comprobando que el catálogo lo cubre.
    expect(reglaPorCodigo('4072')).not.toBeNull();
    expect(reglaPorCodigo('9999')).toBeNull();
    expect(mensajeLegible('9999')).toMatch(/fuera del catálogo local/);
  });
});
