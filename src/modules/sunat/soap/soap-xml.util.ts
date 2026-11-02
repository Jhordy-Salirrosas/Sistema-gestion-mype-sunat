/**
 * Utilidades XML compartidas por los sobres SOAP del billService y del
 * billConsultService.
 *
 * Se extrajeron de soap-envelope.ts (TA-03) sin cambiar su comportamiento: las
 * dos operaciones necesitan las mismas tres funciones y duplicarlas habria
 * dejado dos versiones del mismo escaping.
 */

/** Escapa el texto para que sea seguro dentro de un nodo XML. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Estrecha un valor desconocido a un objeto plano, o null. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Devuelve el texto de un nodo, soportando que fast-xml-parser lo entregue como
 * string o como objeto con #text cuando el nodo trae atributos.
 */
export function nodeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  const record = asRecord(value);
  if (record && '#text' in record) return nodeText(record['#text']);
  return null;
}
