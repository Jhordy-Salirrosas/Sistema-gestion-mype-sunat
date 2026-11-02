/**
 * Pruebas contra las hojas XSL OFICIALES de SUNAT.
 *
 * Las hojas se versionan en `assets/sunat-xsl/`, así que estas pruebas corren
 * siempre. Son dos defensas distintas:
 *
 *  1. Huellas: si alguien reemplaza una hoja (a mano, en un merge, o porque
 *     SUNAT publicó otra versión), el test falla y el cambio se revisa. No es
 *     un requisito de estilo: el sistema EJECUTA ese archivo sobre datos
 *     tributarios, y un reemplazo silencioso cambiaría las reglas de validación
 *     sin que nadie lo note.
 *
 *  2. Humo: la hoja oficial, normalizada, tiene que ejecutarse de verdad sobre
 *     un XML UBL 2.1 real y devolver un resultado interpretable.
 *
 * Si de verdad hay que subir de versión, se actualiza `HUELLAS` en el mismo
 * commit que los archivos: así queda en el historial qué cambió y cuándo.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SunatXslValidatorService,
  XSL_POR_TIPO,
} from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

const DIR = process.env.SUNAT_XSL_DIR ?? join(process.cwd(), 'assets', 'sunat-xsl');

/** sha256 de cada hoja oficial, tal como se descargaron del portal. */
const HUELLAS: Record<string, string> = {
  'Factura 2.0.1.xsl': '63c13757f5730cbd',
  'Boleta 2.0.1.xsl': '14c52ebe42cd1d14',
  'Nota de Credito 2.0.1.xsl': '0764b994504b5cae',
  'Nota de Debito 2.0.1.xsl': '10e096e84eba9fb9',
};

describe('TA-31 huellas de las hojas XSL versionadas', () => {
  it.each(Object.entries(HUELLAS))(
    'la hoja %s está en el repositorio',
    (archivo) => {
      expect(existsSync(join(DIR, archivo))).toBe(true);
    },
  );

  it.each(Object.entries(HUELLAS))(
    'la hoja %s no fue reemplazada',
    (archivo, prefijo) => {
      const ruta = join(DIR, archivo);
      if (!existsSync(ruta)) return;
      const sha = createHash('sha256').update(readFileSync(ruta)).digest('hex');
      expect(sha.startsWith(prefijo)).toBe(true);
    },
  );

  it('las hojas de los cuatro tipos están versionadas', () => {
    for (const archivo of Object.values(XSL_POR_TIPO)) {
      expect(existsSync(join(DIR, archivo))).toBe(true);
    }
  });
});

describe('TA-31 con las hojas OFICIALES', () => {
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
