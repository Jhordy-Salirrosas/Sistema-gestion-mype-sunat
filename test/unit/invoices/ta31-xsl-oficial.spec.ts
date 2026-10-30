/**
 * Prueba de humo contra las hojas XSL OFICIALES instaladas en sunat-xsl/.
 * No se versiona el .xsl, así que el test se salta si no están.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

const DIR = process.env.SUNAT_XSL_DIR ?? join(process.cwd(), 'sunat-xsl');
const HAY_XSL = existsSync(join(DIR, 'Factura 2.0.1.xsl'));

(HAY_XSL ? describe : describe.skip)('TA-31 con las hojas OFICIALES', () => {
  const xmlFactura = readFileSync(
    join(__dirname, '../../../fixtures/sunat-invoice/factura-ubl21.xml'),
    'utf8',
  );

  it('ejecuta la hoja oficial de Factura sobre un XML real', async () => {
    const servicio = new SunatXslValidatorService();

    const resultado = await servicio.validar(xmlFactura, '01');

    expect(resultado.bloqueado).toBe(false);
    expect(resultado.motivoBloqueo).toBeNull();
    expect(Array.isArray(resultado.errores)).toBe(true);
  }, 30000);

  it('bloquea cuando el tipo no tiene hoja mapeada', async () => {
    const servicio = new SunatXslValidatorService();

    const resultado = await servicio.validar(xmlFactura, '20');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivoBloqueo).toContain('No hay hoja XSL mapeada');
  });
});
