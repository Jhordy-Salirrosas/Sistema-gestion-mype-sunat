/**
 * Construccion del sobre SOAP y lectura de la respuesta del billService.
 *
 * Se arma el XML con plantillas de texto en lugar de usar una libreria SOAP
 * pesada: el contrato es document/literal, tiene una sola operacion y el
 * mensaje es fijo, asi que una plantilla es mas simple y auditable. Ver ADR-02.
 */
import { XMLParser } from 'fast-xml-parser';
import {
  SOAP_ENVELOPE_NAMESPACE,
  SUNAT_SEND_BILL_SOAP_ACTION,
  SUNAT_SERVICE_NAMESPACE,
  SUNAT_SERVICE_PREFIX,
  WSSE_NAMESPACE,
  WSSE_PASSWORD_TYPE,
} from './soap.constants';

export interface SendBillCredentials {
  /**
   * Usuario SOL secundario tal como lo espera SUNAT: RUC + usuario.
   * Ejemplo: 20123456789MODDATOS
   */
  username: string;
  /** Clave SOL. */
  password: string;
}

export interface BuildSendBillEnvelopeParams {
  /** Nombre del ZIP: RUC-TIPO-SERIE-CORRELATIVO.zip */
  fileName: string;
  /** Contenido del ZIP (XML firmado) YA en Base64. */
  contentFileBase64: string;
  /**
   * Credenciales SOL. Si no se envian, el sobre va sin el encabezado
   * WS-Security: asi el mismo cliente sirve contra el Mock de TA-06, que no
   * valida credenciales.
   */
  credentials?: SendBillCredentials | null;
}

/** Escapa el texto para que sea seguro dentro de un nodo XML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Cabecera WS-Security con UsernameToken.
 * Se usa PasswordText (no PasswordDigest): es el tipo que emplean las
 * implementaciones de produccion verificadas del billService.
 */
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
 * Arma el sobre SOAP 1.1 de la operacion sendBill.
 *
 * Reglas del contrato que se respetan:
 *  - El Body usa http://service.sunat.gob.pe (NO el targetNamespace del WSDL).
 *  - fileName va antes que contentFile: el XSD los declara en sequence.
 *  - contentFile es base64Binary inline: NO se usa MTOM/XOP.
 *  - partyType es opcional y no se envia (produccion tampoco lo envia).
 */
export function buildSendBillEnvelope(
  params: BuildSendBillEnvelopeParams,
): string {
  const header = params.credentials
    ? buildSecurityHeader(params.credentials)
    : '  <soapenv:Header/>';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENVELOPE_NAMESPACE}" xmlns:${SUNAT_SERVICE_PREFIX}="${SUNAT_SERVICE_NAMESPACE}">`,
    header,
    '  <soapenv:Body>',
    `    <${SUNAT_SERVICE_PREFIX}:sendBill>`,
    `      <fileName>${escapeXml(params.fileName)}</fileName>`,
    `      <contentFile>${params.contentFileBase64}</contentFile>`,
    `    </${SUNAT_SERVICE_PREFIX}:sendBill>`,
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n');
}

/**
 * Error de negocio devuelto por SUNAT como SOAP Fault.
 *
 * Un SOAP Fault llega normalmente con HTTP 500. Eso NO es un fallo de
 * transporte: SUNAT respondio y el error es determinista (credenciales, XML,
 * numeracion). Tratarlo como error de red produciria reintentos inutiles.
 */
export class SunatSoapFaultError extends Error {
  readonly faultCode: string | null;
  readonly faultString: string | null;
  /** Codigo de negocio de 4 digitos extraido de faultcode/faultstring. */
  readonly sunatCode: string | null;

  constructor(params: {
    faultCode?: string | null;
    faultString?: string | null;
  }) {
    const faultCode = params.faultCode ?? null;
    const faultString = params.faultString ?? null;
    const sunatCode = extractSunatCode(faultCode, faultString);

    super(
      `SOAP Fault del billService${sunatCode ? ` [${sunatCode}]` : ''}: ${
        faultString ?? faultCode ?? 'sin detalle'
      }`,
    );
    this.name = 'SunatSoapFaultError';
    this.faultCode = faultCode;
    this.faultString = faultString;
    this.sunatCode = sunatCode;
  }
}

/**
 * El codigo de negocio viaja en faultcode y/o embebido en faultstring
 * ("0156 El archivo ZIP esta vacio"). Se busca el primer grupo de 4 digitos.
 */
export function extractSunatCode(
  faultCode?: string | null,
  faultString?: string | null,
): string | null {
  for (const candidate of [faultCode, faultString]) {
    if (!candidate) continue;
    const match = /(\d{4})/.exec(candidate);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parser tolerante: sin prefijos de namespace (SUNAT alterna cac:/cbc: con
 * ns3:/ns4:), sin conversion de valores a numero (perderia el cero inicial de
 * 0100) y viendo atributos (el codigo de respuesta puede traer listAgencyName).
 */
const responseParser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Devuelve el texto de un nodo, soportando que fast-xml-parser lo entregue como
 * string o como objeto con #text cuando el nodo trae atributos.
 */
function nodeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  const record = asRecord(value);
  if (record && '#text' in record) return nodeText(record['#text']);
  return null;
}

export interface ParsedSoapResponse {
  /** applicationResponse tal cual (Base64 del ZIP con el CDR). */
  applicationResponse: string | null;
  /** SOAP Fault detectado, si lo hubo. */
  fault: SunatSoapFaultError | null;
}

/**
 * Extrae applicationResponse o el SOAP Fault del sobre de respuesta.
 *
 * applicationResponse es minOccurs=0: puede venir ausente o vacio. Eso NO es
 * un rechazo tributario, es un CDR no encontrado, o sea un error de
 * integracion.
 */
export function parseSendBillResponse(xml: string): ParsedSoapResponse {
  let parsed: unknown;
  try {
    parsed = responseParser.parse(xml);
  } catch {
    // Un cuerpo que no es XML (por ejemplo una pagina de error HTML de un proxy).
    return { applicationResponse: null, fault: null };
  }

  const envelope = asRecord(asRecord(parsed)?.Envelope);
  const body = asRecord(envelope?.Body);
  if (!body) return { applicationResponse: null, fault: null };

  const faultNode = asRecord(body.Fault);
  if (faultNode) {
    return {
      applicationResponse: null,
      fault: new SunatSoapFaultError({
        faultCode:
          nodeText(faultNode.faultcode) ?? nodeText(faultNode.Code) ?? null,
        faultString:
          nodeText(faultNode.faultstring) ?? nodeText(faultNode.Reason) ?? null,
      }),
    };
  }

  const responseNode = asRecord(body.sendBillResponse);
  const applicationResponse = nodeText(responseNode?.applicationResponse);

  return {
    applicationResponse:
      applicationResponse && applicationResponse.trim() !== ''
        ? applicationResponse.trim()
        : null,
    fault: null,
  };
}

/** Valor para el encabezado HTTP SOAPAction. */
export const SEND_BILL_SOAP_ACTION = SUNAT_SEND_BILL_SOAP_ACTION;
