/** Lee los códigos realmente presentes en el XML firmado, sin inferir tributos. */
export interface TributoLineaXml {
  id: string | null;
  descripcion: string | null;
  afectacion: string | null;
  tributo: string | null;
}

const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const texto = (nodo: Element, ns: string, nombre: string): string | null =>
  nodo.getElementsByTagNameNS(ns, nombre)[0]?.textContent?.trim() || null;

export const leerTributosXml = (xml: string): TributoLineaXml[] => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const lineas = ['InvoiceLine', 'CreditNoteLine', 'DebitNoteLine'].flatMap((nombre) =>
    Array.from(doc.getElementsByTagNameNS(CAC, nombre)),
  );
  return lineas.flatMap((linea) => {
    const subtotales = Array.from(linea.getElementsByTagNameNS(CAC, 'TaxSubtotal'));
    return subtotales.map((subtotal) => {
      const scheme = subtotal.getElementsByTagNameNS(CAC, 'TaxScheme')[0];
      return {
        id: texto(linea, CBC, 'ID'),
        descripcion: texto(linea, CBC, 'Description'),
        afectacion: texto(subtotal, CBC, 'TaxExemptionReasonCode'),
        tributo: scheme ? texto(scheme, CBC, 'ID') : null,
      };
    });
  });
};

export const NOMBRES_AFECTACION: Record<string, string> = {
  '10': 'Gravado - Operación onerosa', '11': 'Gravado - Retiro por premio',
  '12': 'Gravado - Retiro por donación', '13': 'Gravado - Retiro por publicidad',
  '14': 'Gravado - Bonificaciones', '15': 'Gravado - Retiro por entrega a trabajadores',
  '16': 'Gravado - Retiro', '17': 'Gravado - Retiro por premio (IVAP)',
  '20': 'Exonerado - Operación onerosa', '21': 'Exonerado - Transferencia gratuita',
  '30': 'Inafecto - Operación onerosa', '31': 'Inafecto - Retiro por bonificación',
  '32': 'Inafecto - Retiro', '33': 'Inafecto - Retiro por muestras médicas',
  '34': 'Inafecto - Retiro por convenio colectivo', '35': 'Inafecto - Retiro por premio',
  '36': 'Inafecto - Retiro por publicidad', '37': 'Inafecto - Retiro por entrega a trabajadores',
  '40': 'Exportación de bienes o servicios',
};
export const NOMBRES_TRIBUTO: Record<string, string> = {
  '1000': 'IGV', '1016': 'IVAP', '2000': 'ISC', '7152': 'ICBPER',
  '9995': 'Exportación', '9996': 'Gratuito - No oneroso',
  '9997': 'Exonerado - No gravado', '9998': 'Inafecto - No gravado',
};
export const rotularCodigo = (codigo: string | null, nombres: Record<string, string>): string =>
  codigo ? `${codigo} - ${nombres[codigo] ?? 'Código no reconocido'}` : 'No registrado';

/** Solo evalúa nodos AllowanceCharge presentes en el XML firmado. */
export const requiereRevisionContableXml = (xml: string): boolean => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return false;
  return Array.from(doc.getElementsByTagNameNS(CAC, 'AllowanceCharge')).some((cargo) =>
    ['01', '03'].includes(texto(cargo, CBC, 'AllowanceChargeReasonCode') ?? ''),
  );
};
