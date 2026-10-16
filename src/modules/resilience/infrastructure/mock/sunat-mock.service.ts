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

/** Opciones del CDR: permite generar aceptacion o rechazo (TA-14). */
export interface SendBillOptions {
  filename?: string;
  responseCode?: string; // '0' para exito; '2000', '2324', etc. para rechazo
  description?: string;
}

/** Respuesta que el Mock debe enviar al cliente (TA-12). */
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
   *
   * Acepta un string (compatibilidad con TA-06) o un objeto de opciones (TA-14):
   * si responseCode === '0' genera CDR aceptado; si no, CDR de rechazo con el
   * codigo y la descripcion indicados.
   */
  generateSendBillResponse(options?: SendBillOptions | string): string {
    const opts: SendBillOptions =
      typeof options === 'string' ? { filename: options } : options || {};

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
   * Genera una respuesta SOAP Fault con codigo de error y detalle estructural.
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

  /**
   * Decide la respuesta segun el RUC emisor que viaja en el nombre del archivo
   * (TA-12). Si el RUC activa un modo de fallo, lo aplica; si no, devuelve el
   * CDR aceptado, que es el comportamiento por defecto del Mock.
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
          body: this.generateSendBillResponse({ filename: fileName }),
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
      // Se reutiliza el generador de Fault de TA-14 para que la estructura del
      // sobre sea una sola en todo el Mock.
      body: this.generateSoapFaultResponse(
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
      body: this.generateSendBillResponse({ filename: fileName }),
    };
  }
}
