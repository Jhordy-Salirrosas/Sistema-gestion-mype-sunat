/**
 * Operación getStatusCdr del consultService de SUNAT (TA-30).
 *
 * Cuando `sendBill` termina en timeout el comprobante queda en estado
 * incierto: SUNAT pudo haberlo procesado y su CDR se perdió. En vez de
 * reenviarlo (que produciría el duplicado que evita TA-32), se pregunta por
 * él con `getStatusCdr`, que devuelve el estado y, si existe, el CDR.
 *
 * Corazón del módulo:
 *   1. Construir el sobre SOAP con los parámetros que pide la operación.
 *   2. Interpretar la respuesta distinguiendo tres casos que NO son lo mismo:
 *        - CDR presente        -> comprobante procesado, se recupera.
 *        - código 0127         -> SUNAT no lo tiene, reenviar es seguro.
 *        - cualquier otro      -> no se pudo determinar, no se reenvía.
 *
 * El nombre del servicio y su namespace están verificados en
 * `soap.constants.ts`; aquí solo se usa lo que corresponde a esta operación.
 */
import { DOMParser } from '@xmldom/xmldom';
import {
  SOAP_ENVELOPE_NAMESPACE,
  SUNAT_SERVICE_NAMESPACE,
  SUNAT_SERVICE_PREFIX,
  WSSE_NAMESPACE,
} from './soap.constants';
import type { SendBillCredentials } from './soap-envelope';

/** SOAPAction de la operación; ausente en el WSDL, SUNAT acepta `urn:getStatusCdr`. */
export const GET_STATUS_CDR_SOAP_ACTION = 'urn:getStatusCdr';

/**
 * Código con el que SUNAT responde cuando el comprobante no existe.
 *
 * Es la única respuesta que autoriza a reenviar: significa que el envío
 * anterior nunca llegó a registrarse.
 */
export const SUNAT_CODE_NO_ENCONTRADO = '0127';

/** Parámetros de la consulta: la identidad fiscal del comprobante. */
export interface GetStatusCdrParams {
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  /** Correlativo SIN ceros de relleno, igual que en el nombre del ZIP. */
  correlativo: number;
  credentials?: SendBillCredentials | null;
}

/** Respuesta ya interpretada. */
export interface StatusCdrResult {
  /** true si SUNAT conoce el comprobante. */
  encontrado: boolean;
  /** CDR en Base64 (ZIP), si SUNAT ya lo generó. */
  applicationResponse: string | null;
  /** Código de respuesta del CDR o de la operación, si vino. */
  responseCode: string | null;
  /** Descripción legible de SUNAT. */
  description: string | null;
  /** Serie-correlativo que SUNAT asocia al comprobante. */
  referenceId: string | null;
  tiempoRespuestaMs: number;
  httpStatus: number;
  rawResponse: string;
}

/** Escapa el texto para que no rompa el XML. */
function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Crece el correlativo a 8 dígitos, como el `cbc:ID` del comprobante. */
function correlativoRelleno(correlativo: number): string {
  return String(correlativo).padStart(8, '0');
}

/**
 * Construye el sobre SOAP de `getStatusCdr`.
 *
 * El usuario SOL se compone igual que en `sendBill` (RUС + usuario); si no hay
 * credenciales el sobre va sin WS-Security, que es lo que necesita el Mock.
 */
export function buildGetStatusCdrEnvelope(params: GetStatusCdrParams): string {
  const ruc = escapeXml(params.rucEmisor.trim());
  const tipo = escapeXml(params.tipoComprobante.trim().padStart(2, '0'));
  const serie = escapeXml(params.serie.trim().toUpperCase());
  const correlativo = correlativoRelleno(params.correlativo);

  const seguridad = params.credentials
    ? `
    <soapenv:Header>
      <wsse:Security xmlns:wsse="${WSSE_NAMESPACE}" soapenv:mustUnderstand="1">
        <wsse:UsernameToken>
          <wsse:Username>${escapeXml(params.credentials.username)}</wsse:Username>
          <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(params.credentials.password)}</wsse:Password>
        </wsse:UsernameToken>
      </wsse:Security>
    </soapenv:Header>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_ENVELOPE_NAMESPACE}">${seguridad}
  <soapenv:Body>
    <${SUNAT_SERVICE_PREFIX}:getStatusCdr xmlns:${SUNAT_SERVICE_PREFIX}="${SUNAT_SERVICE_NAMESPACE}">
      <${SUNAT_SERVICE_PREFIX}:rucComprobante>${ruc}</${SUNAT_SERVICE_PREFIX}:rucComprobante>
      <${SUNAT_SERVICE_PREFIX}:tipoComprobante>${tipo}</${SUNAT_SERVICE_PREFIX}:tipoComprobante>
      <${SUNAT_SERVICE_PREFIX}:serieComprobante>${serie}</${SUNAT_SERVICE_PREFIX}:serieComprobante>
      <${SUNAT_SERVICE_PREFIX}:numeroComprobante>${correlativo}</${SUNAT_SERVICE_PREFIX}:numeroComprobante>
    </${SUNAT_SERVICE_PREFIX}:getStatusCdr>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Resultado crudo del parseo, antes de decidir si el comprobante existe. */
export interface ParsedStatusCdrResponse {
  applicationResponse: string | null;
  responseCode: string | null;
  description: string | null;
  referenceId: string | null;
}

/**
 * Interpreta la respuesta de `getStatusCdr`.
 *
 * Se usa el parser DOM y no expresiones regulares porque la respuesta trae el
 * CDR en Base64 dentro de un nodo y un Base64 puede contener secuencias que
 * una expresión regular mal construida confundiría con una etiqueta.
 *
 * OJO: `getElementsByTagName('statusCdrResult')` NO encuentra
 * `<ns0:statusCdrResult>`; hay que buscar por nombre local quitando el
 * prefijo, que es lo que hace `buscarPorNombreLocal`. Los prefijos cambian
 * entre versiones de SUNAT (`ns0`, `ns2`, `ser`), así que depender de ellos
 * sería frágil.
 */
export function parseGetStatusCdrResponse(xml: string): ParsedStatusCdrResponse {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  /** Texto del primer nodo con ese nombre local, con o sin prefijo. */
  const buscar = (nombre: string): string | null => {
    const todos = doc.getElementsByTagName('*');
    for (let i = 0; i < todos.length; i += 1) {
      const nodo = todos[i];
      const local = (nodo.localName ?? nodo.nodeName).split(':').pop();
      if (local === nombre) {
        const texto = nodo.textContent?.trim();
        if (texto) return texto;
      }
    }
    return null;
  };

  return {
    applicationResponse: buscar('statusCdrResult') ?? buscar('applicationResponse'),
    responseCode: buscar('statusCode') ?? buscar('responseCode'),
    description: buscar('statusMessage') ?? buscar('description'),
    referenceId: buscar('content') ?? buscar('referenceId'),
  };
}
