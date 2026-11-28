/** Datos del maestro necesarios para cruzar la identidad del receptor, sin alterar el payload. */
export interface ReceptorRegistrado { doc_type: string; doc_number: string; legal_name: string }

const nombreComparable = (nombre: string) => nombre.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE');

export function problemaIdentidadReceptor(documento: string, nombre: string, registrados: readonly ReceptorRegistrado[]): string | undefined {
  const doc = documento.trim();
  const tipo = /^\d{11}$/.test(doc) ? '6' : /^\d{8}$/.test(doc) ? '1' : undefined;
  if (!tipo) return;
  const registrado = registrados.find(p => p.doc_type === tipo && p.doc_number.trim() === doc);
  if (!registrado || nombreComparable(nombre) === nombreComparable(registrado.legal_name)) return;
  return tipo === '6'
    ? `La razón social no coincide con la registrada para el RUC ${doc}: ${registrado.legal_name}`
    : `El nombre no coincide con el registrado para el DNI ${doc}: ${registrado.legal_name}`;
}
