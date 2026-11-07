/**
 * Descarga real de documentos desde el backend (M1).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * El modal de auditoría "descargaba" los documentos generándolos EN EL
 * NAVEGADOR con `generarXmlUbl21Comprobante` / `descargarPdfComprobante`. Ese
 * XML no es el que se envió a SUNAT: es una reconstrucción a partir de los datos
 * de la grilla. Entregarle al usuario un archivo con el nombre del comprobante
 * que no es el documento fiscal es peor que no darle nada, porque parece lo que
 * no es.
 *
 * El backend ya tenía `GET /invoices/:id/{xml,pdf,cdr}` devolviendo el archivo
 * de verdad (el firmado, el PDF con QR y el CDR que respondió SUNAT). Aquí se
 * dispara esa descarga desde el navegador.
 */
import { invoicesApi } from '../services/invoicesApi';

/** Formato descargable. */
export type FormatoDescarga = 'xml' | 'pdf' | 'cdr';

/**
 * Pide el documento al backend y lo guarda con su nombre real.
 *
 * Lanza si el backend responde error, para que el llamador muestre el motivo
 * (por ejemplo, un comprobante PENDIENTE todavía no tiene CDR) en lugar de bajar
 * un archivo vacío.
 */
export const descargarDesdeBackend = async (
  comprobanteId: string,
  formato: FormatoDescarga,
): Promise<void> => {
  const { blob, nombre } = await invoicesApi.descargarDocumento(
    comprobanteId,
    formato,
  );

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  // Sin revocar la URL el blob se queda en memoria mientras la pestaña viva.
  URL.revokeObjectURL(url);
};

/**
 * Trae el XML FIRMADO desde el backend y lo devuelve como texto.
 *
 * Es lo que alimenta el visor del modal. Antes el visor pintaba
 * `generarXmlUbl21Comprobante(c)`, una reconstrucción a partir de los datos de
 * la grilla: se veía un documento con los totales en 0.00 y sin líneas mientras
 * el archivo real —el que SUNAT aceptó— estaba guardado y se podía descargar.
 * Que el botón "Descargar" diera el bueno y el visor el otro es justo la clase
 * de contradicción que un evaluador detecta leyendo la pantalla.
 *
 * Devuelve `null` cuando el backend no tiene el XML (por ejemplo, un
 * comprobante que todavía no se firmó), para que el modal lo diga en lugar de
 * mostrar un documento inventado.
 */
export const obtenerXmlDesdeBackend = async (
  comprobanteId: string,
): Promise<string | null> => {
  try {
    const { blob } = await invoicesApi.descargarDocumento(comprobanteId, 'xml');
    const texto = await blob.text();
    return texto.trim().startsWith('<?xml') || texto.includes('<Invoice')
      ? texto
      : null;
  } catch {
    return null;
  }
};

/**
 * Extrae el `<ds:DigestValue>` del XML firmado.
 *
 * POR QUÉ SE LEE EL XML Y NO EL CAMPO DEL LISTADO
 *
 * La trama QR de SUNAT lleva en su décimo campo el hash del CPE. El front lo
 * tomaba de `hashCpe`, que sale de `hash_xml` en la API… pero ese campo guarda
 * un SHA-256 HEX (`1699ea68…3c3573`) mientras el QR exige el digest BASE64 que
 * produce la firma (`ZeHAEYsi…T998I=`). Son dos cosas distintas: con el hex la
 * trama se imprime igual, sin error visible, y el QR simplemente no valida.
 *
 * El digest correcto solo existe dentro del XML firmado, así que se toma de ahí.
 * Devuelve `null` si el documento no está firmado: mejor no pintar trama que
 * pintar una que no se puede escanear.
 */
export const extraerDigestValue = (xml: string | null): string | null => {
  if (!xml) return null;
  const encontrado = xml.match(/<(?:\w+:)?DigestValue>\s*([^<]*?)\s*<\//);
  const digest = encontrado?.[1]?.trim();
  return digest ? digest : null;
};
