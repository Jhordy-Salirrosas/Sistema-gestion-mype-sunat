/**
 * Pruebas de la clasificacion de codigos (criterios 4 y 5 de TA-03).
 *
 * Verifican la regla por rangos, la distincion entre fallos reintentables y
 * deterministas, y el caso de "aceptado con observaciones".
 */
import { InvoiceStatus } from '../../../generated/prisma/enums';
import { classifyResponseCode } from './cdr-classifier';
import { classifyCdr } from './cdr.classifier';
import { EMPTY_PARSED_CDR, parseCdr } from './cdr.parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'sunat-cdr');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.base64`), 'utf8').trim();
}

describe('classifyResponseCode (regla de rangos)', () => {
  it('mapea 0 a ACEPTADO', () => {
    expect(classifyResponseCode('0').status).toBe(InvoiceStatus.ACEPTADO);
    expect(classifyResponseCode('0000').status).toBe(InvoiceStatus.ACEPTADO);
    expect(classifyResponseCode('0').valido).toBe(true);
  });

  it('mapea 0100-1999 a EXCEPCION con estado ERROR_RED', () => {
    for (const code of ['0100', '0102', '0156', '0300', '1000', '1999']) {
      const r = classifyResponseCode(code);
      expect(r.kind).toBe('EXCEPCION');
      expect(r.status).toBe(InvoiceStatus.ERROR_RED);
      expect(r.valido).toBe(false);
    }
  });

  it('no reintenta los fallos deterministas, pero si el 0100', () => {
    for (const code of ['0101', '0102', '0161', '0303', '1049']) {
      expect(classifyResponseCode(code).reintentable).toBe(false);
    }
    // 0100 es SUNAT caido: si se reintenta.
    expect(classifyResponseCode('0100').reintentable).toBe(true);
  });

  it('mapea 2000-3999 a RECHAZADO sin reintento', () => {
    for (const code of ['2000', '2326', '3231', '3999']) {
      const r = classifyResponseCode(code);
      expect(r.kind).toBe('RECHAZADO');
      expect(r.status).toBe(InvoiceStatus.RECHAZADO);
      expect(r.reintentable).toBe(false);
      expect(r.valido).toBe(false);
    }
  });

  it('nunca marca como rechazado un codigo de observacion (>= 4000)', () => {
    const r = classifyResponseCode('4031');
    expect(r.kind).toBe('OBSERVACION');
    expect(r.valido).toBe(true);
    expect(r.status).not.toBe(InvoiceStatus.RECHAZADO);
  });

  it('deja 98 y 99 en ENVIADO para conciliar, no en RECHAZADO', () => {
    for (const code of ['98', '99']) {
      const r = classifyResponseCode(code);
      expect(r.status).toBe(InvoiceStatus.ENVIADO);
      expect(r.reintentable).toBe(true);
    }
  });

  it('trata un codigo ausente o ilegible como error recuperable', () => {
    for (const code of ['', '   ', null, undefined, 'ABC']) {
      const r = classifyResponseCode(code);
      expect(r.status).toBe(InvoiceStatus.ERROR_RED);
      expect(r.reintentable).toBe(true);
    }
  });

  it('recupera la descripcion oficial con o sin ceros de relleno', () => {
    expect(classifyResponseCode('1033').description).toBe(
      'El comprobante fue registrado previamente con otros datos',
    );
    // '101' y '0101' son el mismo codigo de SUNAT.
    expect(classifyResponseCode('101').description).toBe(
      'El encabezado de seguridad es incorrecto',
    );
  });
});

describe('classifyCdr (codigo + observaciones)', () => {
  it('un CDR aceptado sin observaciones queda ACEPTADO', () => {
    const r = classifyCdr(parseCdr(loadFixture('aceptado')));
    expect(r.status).toBe(InvoiceStatus.ACEPTADO);
    expect(r.kind).toBe('ACEPTADO');
    expect(r.reintentable).toBe(false);
  });

  it('un CDR con codigo 2326 queda RECHAZADO y no reintentable', () => {
    const r = classifyCdr(parseCdr(loadFixture('rechazado')));
    expect(r.status).toBe(InvoiceStatus.RECHAZADO);
    expect(r.kind).toBe('RECHAZADO');
    expect(r.valido).toBe(false);
    expect(r.reintentable).toBe(false);
  });

  it('un CDR con codigo 0 y observacion queda ACEPTADO_CON_OBSERVACIONES y SIGUE siendo valido', () => {
    const r = classifyCdr(parseCdr(loadFixture('observacion')));
    expect(r.kind).toBe('ACEPTADO_CON_OBSERVACIONES');
    expect(r.valido).toBe(true);
    expect(r.status).toBe(InvoiceStatus.ACEPTADO);
    // Nunca debe marcarse como rechazado: tiene validez tributaria.
    expect(r.status).not.toBe(InvoiceStatus.RECHAZADO);
  });

  it('un CDR con codigo 0100 queda EXCEPCION reintentable', () => {
    const r = classifyCdr(parseCdr(loadFixture('excepcion-0100')));
    expect(r.kind).toBe('EXCEPCION');
    expect(r.status).toBe(InvoiceStatus.ERROR_RED);
    expect(r.reintentable).toBe(true);
  });

  it('un CDR vacio se clasifica como VACIO reintentable', () => {
    const r = classifyCdr(EMPTY_PARSED_CDR);
    expect(r.kind).toBe('VACIO');
    expect(r.status).toBe(InvoiceStatus.ERROR_RED);
    expect(r.reintentable).toBe(true);
  });
});
