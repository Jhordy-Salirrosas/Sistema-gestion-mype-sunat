/**
 * Pruebas contra las hojas XSL OFICIALES de SUNAT.
 *
 * Las hojas se versionan en `assets/sunat-sfs/commons/xsl/validation/2.X/`, así que estas pruebas corren
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
} from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

const DIR = join(process.cwd(), 'assets', 'sunat-sfs', 'commons', 'xsl', 'validation', '2.X');

/** sha256 de cada hoja oficial, tal como se descargaron del portal. */
const HUELLAS: Record<string, string> = {
  'ValidaExprRegFactura-2.0.1.xsl': '99d0538abd70df90b5d9880cd42ed347636fa2aeec2fb55dab94472699ff3379',
  'ValidaExprRegBoleta-2.0.1.xsl': 'e2f6cd8ec6753c8ee202021fee5aa15367290a2d90f417726f7b4bf9bebb59da',
  'ValidaExprRegNC-2.0.1.xsl': 'e41631027f749f10b78941262878b64425d2056387bfc26e0db4cd181a9dfcbc',
  'ValidaExprRegND-2.0.1.xsl': 'd63e5487f7658d6fe9b2b7d088e03dc838b4b4600cd96997e245733c0d4bcc72',
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
    for (const archivo of Object.keys(HUELLAS)) {
      expect(existsSync(join(DIR, archivo))).toBe(true);
    }
  });
});

describe('TA-31 con las hojas OFICIALES', () => {
  const xmlFactura = readFileSync(
    join(__dirname, '../../../fixtures/sunat-invoice/factura-ubl21.xml'),
    'utf8',
  );

  it('TA-70 rechaza el fixture con ExtensionContent vacío mediante XSD oficial', async () => {
    const servicio = new SunatXslValidatorService();

    const resultado = await servicio.validar(xmlFactura, '01');

    expect(resultado.motivoBloqueo).toBeNull();
    expect(resultado.bloqueado).toBe(false);
    expect(resultado.validadoDeVerdad).toBe(true);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toEqual([expect.objectContaining({ codigo: 'XSD', mensaje: expect.stringContaining('ExtensionContent') })]);
  }, 30000);

  it('bloquea cuando el tipo no tiene hoja mapeada', async () => {
    const servicio = new SunatXslValidatorService();

    const resultado = await servicio.validar(xmlFactura, '20');

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivoBloqueo).toContain('No hay hoja XSL mapeada');
  });
});
