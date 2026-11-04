/**
 * Guardado del XML FIRMADO que se envía a SUNAT (M1).
 *
 * EL DEFECTO QUE CORRIGE
 *
 * El worker generaba el XML, lo firmaba con XMLDSig y lo comprimía para enviarlo,
 * pero NUNCA guardaba el resultado. La base dejaba `xml_storage_url` y
 * `xml_hash_sha256` en NULL.
 *
 * Consecuencia visible: el botón "Descargar XML Oficial" regeneraba el documento
 * desde el payload y entregaba un XML SIN `<ds:Signature>`. Es decir, el usuario
 * que abre el archivo esperando ver la firma —que es lo que SUNAT exige y lo que
 * la pantalla dice que se hizo— encontraba un documento DISTINTO del que
 * realmente se envió.
 *
 * Se detectó abriendo el XML descargado en el navegador el 31-10: tenía las tres
 * líneas y los totales correctos, pero el `ext:ExtensionContent` estaba vacío.
 *
 * POR QUÉ SE GUARDA EL XML ENTERO Y NO SOLO UN HASH
 *
 * El hash sirve para verificar, pero no para entregar: el documento que el
 * contribuyente debe poder descargar es el firmado, byte a byte. Guardarlo en la
 * columna `xml_storage_url` (que es texto) evita depender de un almacenamiento
 * externo que el proyecto no tiene.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../../database/prismaService';

@Injectable()
export class SignedXmlStorageService {
  private readonly logger = new Logger(SignedXmlStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarda el XML firmado y su SHA-256.
   *
   * No lanza: el comprobante ya está generado y el envío va a continuar. Si el
   * guardado falla, se registra el aviso y el flujo sigue; perder la copia del
   * XML no debe impedir que el documento fiscal llegue a SUNAT.
   *
   * @returns el hash guardado, o `null` si no se pudo.
   */
  async guardar(invoiceId: string, xmlFirmado: string): Promise<string | null> {
    const hash = createHash('sha256').update(xmlFirmado, 'utf8').digest('hex');

    try {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          xml_storage_url: xmlFirmado,
          xml_hash_sha256: hash,
        },
      });
      return hash;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `No se pudo guardar el XML firmado de ${invoiceId}: ${mensaje}`,
      );
      return null;
    }
  }

  /** SHA-256 del XML firmado, para comparar sin tocar la base. */
  static hash(xmlFirmado: string): string {
    return createHash('sha256').update(xmlFirmado, 'utf8').digest('hex');
  }
}
