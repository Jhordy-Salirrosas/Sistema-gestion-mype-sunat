import { Injectable } from '@nestjs/common';
import AdmZip = require('adm-zip');

export interface SendBillOptions {
  filename?: string;
  responseCode?: string; // '0' para éxito; '2000', '2324', etc. para rechazo
  description?: string;
}

@Injectable()
export class SunatMockService {
  /**
   * Genera la respuesta XML SOAP simulando a la SUNAT.
   * Si responseCode === '0' genera CDR aceptado.
   * Si responseCode !== '0' genera CDR de rechazo con código y descripción oficial.
   */
  generateSendBillResponse(options?: SendBillOptions | string): string {
    const opts: SendBillOptions =
      typeof options === 'string'
        ? { filename: options }
        : options || {};

    const filename = opts.filename || 'R-20000000000-01-F001-1.xml';
    const responseCode = opts.responseCode || '0';
    const isSuccess = responseCode === '0';
    const description =
      opts.description ||
      (isSuccess
        ? 'El comprobante numero F001-1, ha sido aceptado'
        : `El comprobante numero F001-1 ha sido rechazado con codigo ${responseCode}`);

    const cdrXml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse
  xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>1</cbc:ReferenceID>
      <cbc:ResponseCode>${responseCode}</cbc:ResponseCode>
      <cbc:Description>${description}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;

    const zip = new AdmZip();
    zip.addFile(filename, Buffer.from(cdrXml, 'utf8'));
    const zipBase64 = zip.toBuffer().toString('base64');

    return `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>
    <ns0:sendBillResponse xmlns:ns0="http://service.sunat.gob.pe">
      <applicationResponse>${zipBase64}</applicationResponse>
    </ns0:sendBillResponse>
  </S:Body>
</S:Envelope>`;
  }

  /**
   * Genera una respuesta SOAP Fault con código de error y detalle estructural.
   */
  generateSoapFaultResponse(
    faultCode: string = 'S:Client.0100',
    faultString: string = 'El comprobante no cumple con la estructura XML SOAP requerida',
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>
    <S:Fault>
      <faultcode>${faultCode}</faultcode>
      <faultstring>${faultString}</faultstring>
      <detail>
        <message>Error en la cabecera o mensaje SOAP recibido por SUNAT</message>
      </detail>
    </S:Fault>
  </S:Body>
</S:Envelope>`;
  }
}