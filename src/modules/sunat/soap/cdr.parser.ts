/**
 * parseCdr(): funcion PURA que convierte la respuesta del billService en
 * datos del CDR.
 *
 * Pureza (criterio 6 de TA-03): no hace I/O, no toca la base de datos, no lee
 * variables de entorno y no depende del reloj. Todo lo que necesita entra por
 * parametro, por eso se puede probar con fixtures sin levantar nada.
 *
 * Cadena de decodificacion (criterio 2): Base64 -> ZIP -> XML del CDR.
 * El contenido va codificado, NO cifrado: se descomprime directamente.
 */
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export interface CdrObservacion {
  /** Codigo de 4 digitos de la observacion (4xxx), si se pudo leer. */
  codigo: string | null;
  /** Texto completo de la observacion. */
  texto: string;
}

export interface ParsedCdr {
  /**
   * ApplicationResponse/ID: es un ID PROPIO del CDR (numero interno de SUNAT o
   * un UUID). NO es el ID del comprobante; ese va en referenceId.
   */
  id: string | null;
  /**
   * Codigo de respuesta tal cual (string, para no perder el cero inicial de
   * 0100). Es el estado del comprobante.
   */
  responseCode: string;
  /** Description: mensaje legible de SUNAT. */
  description: string | null;
  /** Response/ReferenceID: serie-correlativo del comprobante (F001-1). */
  referenceId: string | null;
  /** Observaciones 4xxx que trae el CDR en Note a nivel de raiz. */
  observaciones: CdrObservacion[];
  /** ResponseDate, si viene. */
  responseDate: string | null;
  /** ResponseTime, si viene. */
  responseTime: string | null;
  /** UBLVersionID (2.0 o 2.1). */
  ublVersion: string | null;
  /** Nombre del archivo XML dentro del ZIP (trazabilidad). */
  xmlFileName: string | null;
  /** XML crudo decodificado, para auditoria y para persistirlo en cdr_sunat. */
  rawXml: string;
}

/** El ZIP no contiene un XML legible: la respuesta no es un CDR valido. */
export class CdrDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CdrDecodeError';
  }
}

/**
 * Parser tolerante, con las mismas garantias que el del sobre SOAP.
 * isArray fuerza que Note sea siempre un arreglo (0, 1 o N observaciones),
 * evitando el clasico "notes.map is not a function".
 */
const cdrParser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  isArray: (name) => name === 'Note',
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Soporta las TRES formas en que fast-xml-parser puede entregar un nodo:
 * ausente, string, u objeto { '#text': ..., '@_atributo': ... }. Ademas
 * aplana arrays (el XSD permite Description con maxOccurs unbounded).
 */
function nodeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = nodeText(item);
      if (text !== null) return text;
    }
    return null;
  }
  const record = asRecord(value);
  if (record && '#text' in record) return nodeText(record['#text']);
  return null;
}

function nodeList(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Convierte el applicationResponse (Base64 del ZIP) en el texto del XML.
 *
 * Se detecta el encoding declarado en el prologo: SUNAT puede entregar el CDR
 * en ISO-8859-1, y decodificarlo como UTF-8 corromperia las tildes de las
 * descripciones y observaciones ("numero" se veria con un caracter roto).
 */
export function decodeApplicationResponse(applicationResponseBase64: string): {
  xml: string;
  xmlFileName: string | null;
} {
  if (!applicationResponseBase64 || applicationResponseBase64.trim() === '') {
    throw new CdrDecodeError(
      'La respuesta del billService no trae applicationResponse (CDR no encontrado)',
    );
  }

  const zipBuffer = Buffer.from(applicationResponseBase64, 'base64');

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new CdrDecodeError('El Base64 decodificado no es un ZIP valido');
  }

  const entry = zip
    .getEntries()
    .find((item) => item.entryName.toLowerCase().endsWith('.xml'));

  if (!entry) {
    throw new CdrDecodeError('El ZIP del CDR no contiene ningun archivo .xml');
  }

  const bytes = entry.getData();
  const prolog = bytes.subarray(0, 200).toString('latin1');
  const encoding = /encoding=["']([^"']+)["']/i
    .exec(prolog)?.[1]
    ?.toLowerCase();
  const isLatin =
    encoding === 'iso-8859-1' ||
    encoding === 'latin1' ||
    encoding === 'windows-1252';

  return {
    xmlFileName: entry.entryName,
    xml: bytes.toString(isLatin ? 'latin1' : 'utf8'),
  };
}

/**
 * Parsea el XML del CDR ya decodificado.
 * Se exporta aparte para poder probar el parseo sin construir un ZIP.
 */
export function parseCdrXml(
  xml: string,
  xmlFileName: string | null = null,
): ParsedCdr {
  let parsed: unknown;
  try {
    parsed = cdrParser.parse(xml);
  } catch (error) {
    throw new CdrDecodeError(
      `El XML del CDR no es parseable: ${
        error instanceof Error ? error.message : 'error desconocido'
      }`,
    );
  }

  // fast-xml-parser devuelve cadena vacia (no un objeto) cuando la raiz no
  // tiene hijos, asi que se normaliza antes de comprobar su existencia.
  const rootValue = asRecord(parsed)?.ApplicationResponse;
  const root = asRecord(rootValue) ?? (rootValue === '' ? {} : null);
  if (!root) {
    throw new CdrDecodeError(
      'El XML del CDR no contiene el nodo raiz ApplicationResponse',
    );
  }

  const documentResponse = nodeList(root.DocumentResponse)
    .map(asRecord)
    .find((item): item is Record<string, unknown> => item !== null);
  const response = asRecord(documentResponse?.Response);

  const responseCode =
    nodeText(response?.ResponseCode) ?? nodeText(root.ResponseCode);
  if (responseCode === null) {
    throw new CdrDecodeError(
      'El CDR no contiene Response/ResponseCode: no se puede determinar el estado',
    );
  }

  const observaciones: CdrObservacion[] = nodeList(root.Note)
    .map((note) => nodeText(note))
    .filter((text): text is string => text !== null)
    .map((texto) => ({
      codigo: /^(\d{4})/.exec(texto)?.[1] ?? null,
      texto,
    }));

  return {
    id: nodeText(root.ID),
    responseCode,
    description: nodeText(response?.Description),
    referenceId: nodeText(response?.ReferenceID),
    observaciones,
    responseDate: nodeText(root.ResponseDate),
    responseTime: nodeText(root.ResponseTime),
    ublVersion: nodeText(root.UBLVersionID),
    xmlFileName,
    rawXml: xml,
  };
}

/**
 * CDR vacio: representa "no hay CDR" (respuesta sin applicationResponse).
 * Se usa como entrada neutra para el clasificador en los caminos de error.
 */
export const EMPTY_PARSED_CDR: ParsedCdr = {
  id: null,
  responseCode: '',
  description: null,
  referenceId: null,
  observaciones: [],
  responseDate: null,
  responseTime: null,
  ublVersion: null,
  xmlFileName: null,
  rawXml: '',
};

/**
 * parseCdr() - funcion pura: Base64 del CDR -> datos del CDR.
 * No persiste nada ni decide el estado: eso son classifyCdr() y el servicio
 * de persistencia.
 */
export function parseCdr(applicationResponseBase64: string): ParsedCdr {
  const { xml, xmlFileName } = decodeApplicationResponse(
    applicationResponseBase64,
  );
  return parseCdrXml(xml, xmlFileName);
}
