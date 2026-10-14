import { HttpStatus, Injectable } from '@nestjs/common';
import AdmZip = require('adm-zip');
import {
  DEFAULT_SLOW_MS,
  DEFAULT_TIMEOUT_MS,
  delay,
  FAULT_HTTP_STATUS_BY_MODE,
  FAULT_SOAP_CODE,
  FAULT_SOAP_MESSAGE,
  extractRucFromFileName,
  resolveFaultMode,
  resolveSlowMs,
  resolveTimeoutMs,
  SunatFaultMode,
} from './sunat-fault-injection.fixtures';

/** Respuesta que el Mock debe enviar al cliente. */
export interface MockBillResponse {
  /** Codigo HTTP de la respuesta. */
  status: number;
  /** Cuerpo de la respuesta (XML). */
  body: string;
}

@Injectable()
export class SunatMockService {
  /**
   * Genera la respuesta XML SOAP simulando a la SUNAT.
   * Internamente construye un ZIP valido en Base64 con un archivo XML (CDR)
   * que contiene el codigo de respuesta '0' (Aceptado).
   */
  generateSendBillResponse(
    filename: string = 'R-20000000000-01-F001-1.xml',
  ): string {
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

  /**
   * Decide la respuesta segun el RUC emisor que viaja en el nombre del archivo.
   * Si el RUC activa un modo de fallo, lo aplica; si no, devuelve el CDR
   * aceptado (comportamiento por defecto del Mock).
   */
  async resolveResponse(fileName: string): Promise<MockBillResponse> {
    const ruc = extractRucFromFileName(fileName);
    const mode = resolveFaultMode(ruc);

    switch (mode) {
      case SunatFaultMode.SERVICE_UNAVAILABLE:
        return this.buildFaultResponse(SunatFaultMode.SERVICE_UNAVAILABLE);

      case SunatFaultMode.SOAP_FAULT:
        return this.buildFaultResponse(SunatFaultMode.SOAP_FAULT, {
          code: FAULT_SOAP_CODE,
          message: FAULT_SOAP_MESSAGE,
        });

      case SunatFaultMode.TIMEOUT:
        return this.buildDelayedResponse(resolveTimeoutMs(), fileName);

      case SunatFaultMode.SLOW:
        return this.buildDelayedResponse(resolveSlowMs(), fileName);

      default:
        // RUC normal: respuesta por defecto del Mock.
        return {
          status: HttpStatus.OK,
          body: this.generateSendBillResponse(fileName),
        };
    }
  }

  /**
   * Respuesta de error: HTTP 503 o SOAP Fault. El codigo HTTP lo determina el
   * mapa de modos, no el controlador.
   */
  private buildFaultResponse(
    mode: SunatFaultMode,
    fault?: { code: string; message: string },
  ): MockBillResponse {
    return {
      status: FAULT_HTTP_STATUS_BY_MODE[mode],
      body: this.buildSoapFault(
        fault?.code ?? String(HttpStatus.SERVICE_UNAVAILABLE),
        fault?.message ?? 'El servicio de SUNAT no esta disponible',
      ),
    };
  }

  /** Respuesta correcta, pero retrasada: simula SUNAT lenta. */
  private async buildDelayedResponse(
    ms: number,
    fileName: string,
  ): Promise<MockBillResponse> {
    await delay(ms);
    return {
      status: HttpStatus.OK,
      body: this.generateSendBillResponse(fileName),
    };
  }

  /** Sobre SOAP 1.1 con Fault, como lo devuelve SUNAT en los errores. */
  private buildSoapFault(code: string, message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>${code}</faultcode>
      <faultstring>${message}</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}
