/**
 * Operacion getStatusCdr del billConsultService de SUNAT.
 *
 * Es la hermana de sendBill y se usa cuando el envio queda en estado
 * INCERTIDUMBRE: el sobre salio, pero la respuesta se perdio (timeout, corte de
 * red). Reenviar sendBill a ciegas en ese escenario provoca los rechazos por
 * duplicidad 1032/1033, asi que lo correcto es PREGUNTAR por el estado del
 * comprobante y recuperar el CDR si SUNAT ya lo proceso.
 *
 * Contrato (WSDL oficial del billConsultService):
 *   - Namespace del Body: el mismo http://service.sunat.gob.pe que sendBill.
 *   - Elementos: rucComprobante, tipoComprobante, serieComprobante,
 *     numeroComprobante (los cuatro obligatorios).
 *   - SOAPAction: "urn:getStatusCdr".
 *   - La respuesta sale en getStatusCdrResponse.statusCdr con los campos
 *     statusCode / statusMessage / content (este ultimo, el CDR en Base64).
 */
import { XMLParser } from 'fast-xml-parser';
import {
  SOAP_ENVELOPE_NAMESPACE,
  SUNAT_SERVICE_NAMESPACE,
  SUNAT_SERVICE_PREFIX,
  WSSE_NAMESPACE,
  WSSE_PASSWORD_TYPE,
} from './soap.constants';
import type { SendBillCredentials } from './soap-envelope';
import { asRecord, escapeXml, nodeText } from './soap-xml.util';

/** Valor del encabezado HTTP SOAPAction para la operacion getStatusCdr. */
export const GET_STATUS_CDR_SOAP_ACTION = 'urn:getStatusCdr';

export interface GetStatusCdrParams {
  /** RUC del emisor del comprobante consultado. */
  rucComprobante: string;
  /** Tipo de comprobante: 01 factura, 03 boleta, 07 NC, 08 ND. */
  tipoComprobante: string;
  /** Serie del comprobante (F001, B001...). */
  serieComprobante: string;
  /** Numero correlativo del comprobante. */
  numeroComprobante: number | string;
  /** Credenciales SOL; si son null el sobre va sin WS-Security (Mock). */
  credentials?: SendBillCredentials | null;
}

/**
 * Respuesta de la consulta. `encontrado: false` significa que SUNAT no tiene
 * registro de ese comprobante (normalmente codigo 0127): el envio NO llego y
 * reenviar sendBill es seguro.
 */
export interface StatusCdrResult {
  /** Codigo oficial del CDR (0000, 0127, 1032...). */
  statusCode: string | null;
  statusMessage: string | null;
  /** CDR en Base64, si SUNAT lo devolvio. */
  applicationResponse: string | null;
  /** true si la consulta devolvio codigo 0000 o un CDR utilizable. */
  encontrado: boolean;
  /** Codigo 0127: SUNAT no tiene el comprobante. */
  noEncontrado: boolean;
  tiempoRespuestaMs: number;
  httpStatus: number;
  rawResponse: string;
}

function buildSecurityHeader(credentials: SendBillCredentials): string {
  return [
    '  <soapenv:Header>',
    `    <wsse:Security xmlns:wsse="${WSSE_NAMESPACE}">`,
    '      <wsse:UsernameToken>',
    `        <wsse:Username>${escapeXml(credentials.username)}</wsse:Username>`,
    `        <wsse:Password Type="${WSSE_PASSWORD_TYPE}">${escapeXml(
      credentials.password,
    )}</wsse:Password>`,
    '      </wsse:UsernameToken>',
    '    </wsse:Security>',
    '  </soapenv:Header>',
  ].join('\n');
}

/**
 * Arma el sobre de getStatusCdr. Los cuatro campos van sin prefijo porque el
 * XSD del billConsultService los declara como elementos locales del Body,
 * tal como en sendBill.
 */
export function buildGetStatusCdrEnvelope(
  params: GetStatusCdrParams,
): string {
  const header = params.credentials
    ? buildSecurityHeader(params.credentials)
    : '  <soapenv:Header/>';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENVELOPE_NAMESPACE}" xmlns:${SUNAT_SERVICE_PREFIX}="${SUNAT_SERVICE_NAMESPACE}">`,
    header,
    '  <soapenv:Body>',
    `    <${SUNAT_SERVICE_PREFIX}:getStatusCdr>`,
    `      <rucComprobante>${escapeXml(params.rucComprobante)}</rucComprobante>`,
    `      <tipoComprobante>${escapeXml(
      params.tipoComprobante.padStart(2, '0'),
    )}</tipoComprobante>`,
    `      <serieComprobante>${escapeXml(
      params.serieComprobante.trim().toUpperCase(),
    )}</serieComprobante>`,
    `      <numeroComprobante>${escapeXml(
      String(params.numeroComprobante),
    )}</numeroComprobante>`,
    `    </${SUNAT_SERVICE_PREFIX}:getStatusCdr>`,
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n');
}

const responseParser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
});

/** Codigo oficial de "no existe informacion del comprobante". */
export const SUNAT_CODE_NO_ENCONTRADO = '0127';

/**
 * Extrae statusCdr del sobre de respuesta del billConsultService.
 *
 * El Fault se devuelve aparte en vez de lanzarse para que el cliente decida:
 * un 0127 llega como statusCdr normal, no como Fault.
 */
export function parseGetStatusCdrResponse(xml: string): {
  statusCode: string | null;
  statusMessage: string | null;
  applicationResponse: string | null;
  faultCode: string | null;
  faultString: string | null;
} {
  let parsed: unknown;
  try {
    parsed = responseParser.parse(xml);
  } catch {
    return {
      statusCode: null,
      statusMessage: null,
      applicationResponse: null,
      faultCode: null,
      faultString: null,
    };
  }

  const envelope = asRecord(asRecord(parsed)?.Envelope);
  const body = asRecord(envelope?.Body);
  if (!body) {
    return {
      statusCode: null,
      statusMessage: null,
      applicationResponse: null,
      faultCode: null,
      faultString: null,
    };
  }

  const faultNode = asRecord(body.Fault);
  if (faultNode) {
    return {
      statusCode: null,
      statusMessage: null,
      applicationResponse: null,
      faultCode:
        nodeText(faultNode.faultcode) ?? nodeText(faultNode.Code) ?? null,
      faultString:
        nodeText(faultNode.faultstring) ?? nodeText(faultNode.Reason) ?? null,
    };
  }

  const responseNode = asRecord(body.getStatusCdrResponse);
  const statusCdr = asRecord(responseNode?.statusCdr);
  const content = nodeText(statusCdr?.content);

  return {
    statusCode: nodeText(statusCdr?.statusCode),
    statusMessage: nodeText(statusCdr?.statusMessage),
    applicationResponse:
      content && content.trim() !== '' ? content.trim() : null,
    faultCode: null,
    faultString: null,
  };
}
