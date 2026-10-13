/**
 * Generador de CDR de prueba para el Mock del billService.
 *
 * Son datos FICTICIOS: el RUC 20123456789 y la serie F001 no corresponden a
 * nadie. Reutiliza la misma logica de empaquetado que el generador de fixtures
 * (adm-zip para el ZIP, Base64 para el transporte).
 */
import AdmZip from 'adm-zip';

export type CdrMockScenario =
  'ACEPTADO' | 'RECHAZADO' | 'OBSERVACION' | 'EXCEPCION';

/** Nombre del XML dentro del ZIP, tal como lo entrega SUNAT. */
export const CDR_XML_ENTRY_NAME = 'R-20123456789-01-F001-1.xml';

export interface BuildCdrXmlOptions {
  responseCode: string;
  description: string;
  /** Observaciones 4xxx: van en Note a nivel de raiz. */
  observaciones?: string[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Arma el XML del CDR (ApplicationResponse UBL 2.0). */
export function buildMockCdrXml(options: BuildCdrXmlOptions): string {
  const { responseCode, description, observaciones = [] } = options;

  const notes = observaciones
    .map((t) => `  <cbc:Note>${escapeXml(t)}</cbc:Note>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:ID>201656892705188</cbc:ID>
${notes ? notes + '\n' : ''}  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>F001-00000001</cbc:ReferenceID>
      <cbc:ResponseCode>${escapeXml(responseCode)}</cbc:ResponseCode>
      <cbc:Description>${escapeXml(description)}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
}

/** Empaqueta el XML en ZIP y lo devuelve en Base64: es applicationResponse. */
export function toApplicationResponse(xml: string): string {
  const zip = new AdmZip();
  zip.addFile(CDR_XML_ENTRY_NAME, Buffer.from(xml, 'utf8'));
  return zip.toBuffer().toString('base64');
}

/** CDR de cada escenario, listo para responder. */
export const MOCK_CDR_BY_SCENARIO: Record<CdrMockScenario, string> = {
  ACEPTADO: toApplicationResponse(
    buildMockCdrXml({
      responseCode: '0',
      description: 'La Factura numero F001-00000001, ha sido aceptada',
    }),
  ),
  RECHAZADO: toApplicationResponse(
    buildMockCdrXml({
      responseCode: '2326',
      description: 'El certificado usado se encuentra de baja',
    }),
  ),
  OBSERVACION: toApplicationResponse(
    buildMockCdrXml({
      responseCode: '0',
      description: 'La Factura numero F001-00000001, ha sido aceptada',
      observaciones: ['4031 - Debe indicar el nombre comercial'],
    }),
  ),
  EXCEPCION: toApplicationResponse(
    buildMockCdrXml({
      responseCode: '0100',
      description:
        'El sistema no puede responder su solicitud. Intente nuevamente o comuniquese con su Administrador',
    }),
  ),
};

/** Palabra clave en el fileName que activa cada escenario. */
export const MOCK_SCENARIO_KEYWORDS: ReadonlyArray<{
  keyword: string;
  scenario: CdrMockScenario;
}> = [
  { keyword: 'RECHAZADO', scenario: 'RECHAZADO' },
  { keyword: 'OBSERVACION', scenario: 'OBSERVACION' },
  { keyword: 'EXCEPCION', scenario: 'EXCEPCION' },
];
