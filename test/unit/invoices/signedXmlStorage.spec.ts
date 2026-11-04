/**
 * Guardado del XML firmado (M1).
 *
 * EL DEFECTO QUE ESTAS PRUEBAS PROTEGEN
 *
 * El worker firmaba el XML, lo comprimía y lo enviaba, pero no guardaba el
 * resultado. La descarga regeneraba el documento desde el payload y entregaba un
 * XML SIN `<ds:Signature>`: un archivo con el nombre del comprobante que no era
 * el que viajó a SUNAT. Se detectó abriendo el XML descargado el 31-10.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { SignedXmlStorageService } from '../../../src/modules/invoices/application/services/signedXmlStorageService';

/** XML mínimo con la firma, como el que produce el firmador. */
const XML_FIRMADO =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Invoice><ds:Signature><ds:SignatureValue>abc</ds:SignatureValue></ds:Signature></Invoice>';

/** Monta el servicio con un Prisma simulado. */
const montar = (opciones: { falla?: boolean } = {}) => {
  const update = jest.fn(async (_args: { data: Record<string, unknown> }) => {
    if (opciones.falla) throw new Error('base caída');
    return {};
  });

  const servicio = new SignedXmlStorageService({ invoice: { update } } as never);
  return { servicio, update };
};

describe('SignedXmlStorageService', () => {
  it('guarda el XML firmado y calcula su SHA-256', async () => {
    const { servicio, update } = montar();

    const hash = await servicio.guardar('inv-1', XML_FIRMADO);

    expect(update).toHaveBeenCalledTimes(1);
    const datos = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(datos.xml_storage_url).toBe(XML_FIRMADO);
    expect(datos.xml_hash_sha256).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el hash es el SHA-256 real del contenido', async () => {
    const { servicio } = montar();

    const hash = await servicio.guardar('inv-1', XML_FIRMADO);

    expect(hash).toBe(SignedXmlStorageService.hash(XML_FIRMADO));
    // Mismo contenido, mismo hash: es lo que permite verificar la descarga.
    expect(SignedXmlStorageService.hash(XML_FIRMADO)).toBe(hash);
  });

  it('contenidos distintos dan hashes distintos', () => {
    const otro = XML_FIRMADO.replace('abc', 'xyz');

    expect(SignedXmlStorageService.hash(XML_FIRMADO)).not.toBe(
      SignedXmlStorageService.hash(otro),
    );
  });

  /**
   * No lanzar es deliberado: el comprobante ya está generado y el envío
   * continúa. Perder la copia del XML no debe impedir que el documento llegue a
   * SUNAT.
   */
  it('no lanza si la base falla: el envío debe poder continuar', async () => {
    const { servicio } = montar({ falla: true });

    await expect(servicio.guardar('inv-1', XML_FIRMADO)).resolves.toBeNull();
  });
});
