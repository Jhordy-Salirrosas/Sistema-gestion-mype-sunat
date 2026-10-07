/**
 * Pruebas de parseCdr() - funcion PURA (criterio 6 de TA-03).
 *
 * Cubre los 3 fixtures obligatorios (aceptado, rechazado y con observacion)
 * mas los casos limite: prefijos de namespace alternativos, encoding
 * ISO-8859-1, ceros iniciales en el codigo y nodos con atributos.
 *
 * No toca red ni base de datos: por eso cubre la logica sin contactar a SUNAT.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { CdrDecodeError, parseCdr } from './cdr.parser';

const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'sunat-cdr');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.base64`), 'utf8').trim();
}

function loadFixtureXml(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.xml`), 'utf8');
}

describe('parseCdr (funcion pura)', () => {
  describe('fixture 1: CDR ACEPTADO', () => {
    it('decodifica Base64 -> ZIP -> XML y extrae codigo, ID y descripcion', () => {
      const cdr = parseCdr(loadFixture('aceptado'));

      expect(cdr.responseCode).toBe('0');
      expect(cdr.description).toContain('ha sido aceptada');
      // El ID del CDR es propio de SUNAT, no el del comprobante.
      expect(cdr.id).toBe('201656892705188');
      // El comprobante referenciado va en referenceId.
      expect(cdr.referenceId).toBe('F001-00000001');
      expect(cdr.observaciones).toEqual([]);
      expect(cdr.ublVersion).toBe('2.0');
      expect(cdr.xmlFileName).toBe('R-20123456789-01-F001-1.xml');
      expect(cdr.rawXml).toContain('ApplicationResponse');
    });
  });

  describe('fixture 2: CDR RECHAZADO', () => {
    it('extrae el codigo 2326 y su descripcion oficial', () => {
      const cdr = parseCdr(loadFixture('rechazado'));

      expect(cdr.responseCode).toBe('2326');
      expect(cdr.description).toBe('El certificado usado se encuentra de baja');
    });
  });

  describe('fixture 3: CDR ACEPTADO CON OBSERVACION', () => {
    it('el codigo sigue siendo 0 y la observacion llega en Note', () => {
      const cdr = parseCdr(loadFixture('observacion'));

      // Trampa clasica: el codigo de un observado NO es distinto de 0.
      expect(cdr.responseCode).toBe('0');
      expect(cdr.observaciones).toHaveLength(1);
      expect(cdr.observaciones[0].codigo).toBe('4031');
      expect(cdr.observaciones[0].texto).toContain('nombre comercial');
    });
  });

  describe('casos limite', () => {
    it('no depende de los prefijos de namespace (ns3/ns4 en UBL 2.1)', () => {
      const cdr = parseCdr(loadFixture('aceptado-ubl21-prefijos-ns'));

      expect(cdr.responseCode).toBe('0');
      expect(cdr.referenceId).toBe('F001-00000001');
      expect(cdr.ublVersion).toBe('2.1');
    });

    it('respeta el encoding ISO-8859-1 declarado en el prologo', () => {
      const cdr = parseCdr(loadFixture('aceptado-latin1'));

      // Sin deteccion de encoding, la descripcion se veria corrupta.
      expect(cdr.description).toContain('Nunez');
      expect(cdr.description).not.toContain('\uFFFD');
    });

    it('conserva el cero inicial de los codigos 0100', () => {
      const cdr = parseCdr(loadFixture('excepcion-0100'));

      expect(cdr.responseCode).toBe('0100');
      expect(cdr.responseCode).not.toBe('100');
    });

    it('soporta un ResponseCode con atributos (nodo convertido en objeto)', () => {
      const cdr = parseCdr(loadFixture('aceptado-con-atributo'));

      expect(cdr.responseCode).toBe('0');
    });

    it('es determinista: dos llamadas dan el mismo resultado', () => {
      const base64 = loadFixture('observacion');
      expect(parseCdr(base64)).toEqual(parseCdr(base64));
    });
  });

  describe('entradas invalidas: se detectan en lugar de devolver datos a medias', () => {
    it('lanza CdrDecodeError con un applicationResponse vacio', () => {
      expect(() => parseCdr('')).toThrow(CdrDecodeError);
    });

    it('lanza CdrDecodeError si el Base64 no es un ZIP', () => {
      const noEsZip = Buffer.from('<html>error 500</html>').toString('base64');
      expect(() => parseCdr(noEsZip)).toThrow(CdrDecodeError);
    });

    it('lanza CdrDecodeError si el ZIP no contiene ningun XML', () => {
      const zip = new AdmZip();
      zip.addFile('leeme.txt', Buffer.from('sin cdr', 'utf8'));

      expect(() => parseCdr(zip.toBuffer().toString('base64'))).toThrow(
        /no contiene ningun archivo \.xml/,
      );
    });

    it('lanza CdrDecodeError si el XML no trae ResponseCode', () => {
      const zip = new AdmZip();
      zip.addFile(
        'R-20123456789-01-F001-1.xml',
        Buffer.from(
          '<?xml version="1.0" encoding="UTF-8"?><ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"></ar:ApplicationResponse>',
          'utf8',
        ),
      );

      expect(() => parseCdr(zip.toBuffer().toString('base64'))).toThrow(
        /ResponseCode/,
      );
    });

    it('trata un ApplicationResponse vacio como CDR invalido', () => {
      const zip = new AdmZip();
      zip.addFile(
        'R-20123456789-01-F001-1.xml',
        Buffer.from(
          '<?xml version="1.0" encoding="UTF-8"?><ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"/>',
          'utf8',
        ),
      );

      expect(() => parseCdr(zip.toBuffer().toString('base64'))).toThrow(
        /ResponseCode/,
      );
    });
  });

  it('los .xml versionados y los .base64 describen el mismo CDR', () => {
    for (const name of ['aceptado', 'rechazado', 'observacion']) {
      const xml = loadFixtureXml(name);
      const cdr = parseCdr(loadFixture(name));

      expect(xml).toContain(
        `<cbc:ResponseCode>${cdr.responseCode}</cbc:ResponseCode>`,
      );
      expect(xml).toContain(cdr.referenceId as string);
    }
  });
});
