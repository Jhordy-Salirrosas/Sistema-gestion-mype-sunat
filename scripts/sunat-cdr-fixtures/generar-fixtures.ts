/**
 * Genera los fixtures del CDR de TA-03 en fixtures/sunat-cdr/.
 *
 * Uso:
 *   npx ts-node scripts/sunat-cdr-fixtures/generar-fixtures.ts
 *
 * Por cada caso se guardan DOS artefactos:
 *   - <caso>.xml    : el XML del CDR legible (revisable a ojo)
 *   - <caso>.base64 : el applicationResponse real (ZIP + Base64), que es lo
 *                     que devuelve SUNAT y lo que consume parseCdr()
 *
 * Reutiliza el PoC de SP-04 (scripts/poc-cdr/), que fue el que valido la
 * cadena Base64 -> ZIP -> XML con adm-zip + fast-xml-parser.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

const OUTPUT_DIR = join(process.cwd(), 'fixtures', 'sunat-cdr');

/** Nombre del XML dentro del ZIP, tal como lo entrega SUNAT. */
const CDR_XML_ENTRY_NAME = 'R-20123456789-01-F001-1.xml';

interface FixtureDefinition {
  name: string;
  xml: string;
  /** Si el XML declara ISO-8859-1, los bytes del ZIP deben ser latin1. */
  encoding?: 'utf8' | 'latin1';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Arma el XML del CDR con la estructura real de ApplicationResponse. */
function buildCdrXml(options: {
  responseCode: string;
  description: string;
  observaciones?: string[];
  ublVersion?: '2.0' | '2.1';
  cdrId?: string;
  referenceId?: string;
}): string {
  const {
    responseCode,
    description,
    observaciones = [],
    ublVersion = '2.0',
    cdrId = '201656892705188',
    referenceId = 'F001-00000001',
  } = options;

  if (ublVersion === '2.1') {
    const notes = observaciones
      .map((t) => `  <ns5:Note>${escapeXml(t)}</ns5:Note>`)
      .join('\n');
    return `<?xml version="1.0" encoding="ISO-8859-1"?>
<ns3:ApplicationResponse xmlns:ns3="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:ns4="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:ns5="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <ns5:UBLVersionID>2.1</ns5:UBLVersionID>
  <ns5:ID>${escapeXml(cdrId)}</ns5:ID>
${notes ? notes + '\n' : ''}  <ns4:DocumentResponse>
    <ns4:Response>
      <ns5:ReferenceID>${escapeXml(referenceId)}</ns5:ReferenceID>
      <ns5:ResponseCode>${escapeXml(responseCode)}</ns5:ResponseCode>
      <ns5:Description>${escapeXml(description)}</ns5:Description>
    </ns4:Response>
  </ns4:DocumentResponse>
</ns3:ApplicationResponse>`;
  }

  const notes = observaciones
    .map((t) => `  <cbc:Note>${escapeXml(t)}</cbc:Note>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(cdrId)}</cbc:ID>
${notes ? notes + '\n' : ''}  <cbc:ResponseDate>2026-10-06</cbc:ResponseDate>
  <cbc:ResponseTime>10:15:30</cbc:ResponseTime>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>${escapeXml(referenceId)}</cbc:ReferenceID>
      <cbc:ResponseCode>${escapeXml(responseCode)}</cbc:ResponseCode>
      <cbc:Description>${escapeXml(description)}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
}

function buildFixtures(): FixtureDefinition[] {
  return [
    {
      // Fixture 1 (obligatorio): ACEPTADO, codigo 0 sin observaciones.
      name: 'aceptado',
      xml: buildCdrXml({
        responseCode: '0',
        description: 'La Factura numero F001-00000001, ha sido aceptada',
      }),
    },
    {
      // Fixture 2 (obligatorio): RECHAZADO, codigo 2xxx sin validez tributaria.
      name: 'rechazado',
      xml: buildCdrXml({
        responseCode: '2326',
        description: 'El certificado usado se encuentra de baja',
      }),
    },
    {
      // Fixture 3 (obligatorio): ACEPTADO CON OBSERVACIONES.
      // El codigo sigue siendo 0; la observacion 4xxx va en Note.
      name: 'observacion',
      xml: buildCdrXml({
        responseCode: '0',
        description: 'La Factura numero F001-00000001, ha sido aceptada',
        observaciones: ['4031 - Debe indicar el nombre comercial'],
      }),
    },
    {
      // Caso limite: prefijos ns3/ns4 y UBL 2.1. El parseo no debe depender
      // de los prefijos, porque SUNAT los elige libremente.
      name: 'aceptado-ubl21-prefijos-ns',
      xml: buildCdrXml({
        responseCode: '0',
        description: 'La Factura numero F001-00000001, ha sido aceptada',
        ublVersion: '2.1',
      }),
    },
    {
      // Caso limite: CDR en ISO-8859-1 con tildes. Decodificar como UTF-8
      // corromperia la descripcion.
      name: 'aceptado-latin1',
      xml: buildCdrXml({
        responseCode: '0',
        description:
          'La Factura numero F001-00000001, ha sido aceptada. Razon social: Nunez',
      }).replace('encoding="UTF-8"', 'encoding="ISO-8859-1"'),
      encoding: 'latin1',
    },
    {
      // Caso limite: excepcion 0100. Con las opciones por defecto de
      // fast-xml-parser el cero inicial se perderia y quedaria 100.
      name: 'excepcion-0100',
      xml: buildCdrXml({
        responseCode: '0100',
        description:
          'El sistema no puede responder su solicitud. Intente nuevamente o comuniquese con su Administrador',
      }),
    },
    {
      // Caso limite: ResponseCode con atributo listAgencyName, que convierte
      // el nodo en objeto { '#text': '0', '@_listAgencyName': ... }.
      name: 'aceptado-con-atributo',
      xml: buildCdrXml({
        responseCode: '0',
        description: 'La Factura numero F001-00000001, ha sido aceptada',
      }).replace(
        '<cbc:ResponseCode>0</cbc:ResponseCode>',
        '<cbc:ResponseCode listAgencyName="PE:SUNAT">0</cbc:ResponseCode>',
      ),
    },
  ];
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const definition of buildFixtures()) {
    const xmlBuffer = Buffer.from(
      definition.xml,
      definition.encoding === 'latin1' ? 'latin1' : 'utf8',
    );

    writeFileSync(join(OUTPUT_DIR, `${definition.name}.xml`), xmlBuffer);

    const zip = new AdmZip();
    zip.addFile(CDR_XML_ENTRY_NAME, xmlBuffer);
    const base64 = zip.toBuffer().toString('base64');
    writeFileSync(join(OUTPUT_DIR, `${definition.name}.base64`), base64);

    console.log(
      `OK ${definition.name}.xml + ${definition.name}.base64 (${base64.length} chars)`,
    );
  }

  console.log(`\nFixtures generados en ${OUTPUT_DIR}`);
}

main();
