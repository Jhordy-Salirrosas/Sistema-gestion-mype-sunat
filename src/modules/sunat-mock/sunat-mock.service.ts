import { Injectable } from '@nestjs/common';
import AdmZip = require('adm-zip');
@Injectable()
export class SunatMockService {
  /**
   * Genera la respuesta XML SOAP simulando a la SUNAT.
   * Internamente construye un ZIP válido en Base64 con un archivo XML (CDR) 
   * que contiene el código de respuesta '0' (Aceptado).
   */
  generateSendBillResponse(filename: string = 'R-20000000000-01-F001-1.xml'): string {
    const cdrXml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse 
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>1</cbc:ReferenceID>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>El comprobante numero F001-1, ha sido aceptado</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

    // Crear un archivo ZIP en memoria
    const zip = new AdmZip();
    zip.addFile(filename, Buffer.from(cdrXml, 'utf8'));

    // Convertirlo a Base64
    const zipBase64 = zip.toBuffer().toString('base64');

    // Construir la respuesta SOAP (SOAP Envelope)
    const soapResponse = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>
    <ns0:sendBillResponse xmlns:ns0="http://service.sunat.gob.pe">
      <applicationResponse>${zipBase64}</applicationResponse>
    </ns0:sendBillResponse>
  </S:Body>
</S:Envelope>`;

    return soapResponse;
  }
}
