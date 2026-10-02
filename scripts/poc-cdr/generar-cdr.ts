import AdmZip from 'adm-zip';

// 1. El XML del CDR (simulado y simplificado: el real trae más nodos y una firma digital)
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>F001-1</cbc:ReferenceID>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>La Factura numero F001-1, ha sido aceptada</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

// 2. Crear un ZIP vacío (en memoria, no en disco)
const zip = new AdmZip();

// 3. TODO: agregar el XML al ZIP con zip.addFile(nombre, contenido)
zip.addFile('R-20050422000-01-F001-1.xml', Buffer.from(xml, 'utf8'));

// 4. TODO: obtener el ZIP completo como Buffer.
const zipBuffer = zip.toBuffer();

// 5. TODO: convertir ese Buffer a Base64 y mostrarlo con console.log
const base64 = zipBuffer.toString('base64');
console.log(base64);