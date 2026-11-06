import type { IssuerContext } from '../issuerConfigResolver';
/**
 * Operaciones SOAP `sendSummary` y `getStatus` del billService (TA-67).
 *
 * El resumen diario y la comunicación de baja NO se envían con `sendBill`: usan
 * `sendSummary`, que no devuelve el CDR sino un **número de ticket**. El CDR hay
 * que pedirlo después con `getStatus(ticket)` y puede tardar:
 *
 *   1. `sendSummary` → devuelve un ticket como "1234567890".
 *   2. `getStatus` con ese ticket → mientras SUNAT procesa responde el código
 *      **98** ("en proceso") o **99** ("procesando"); cuando termina responde
 *      con el contenido del CDR en Base64.
 *
 * Tratar el 98 como error hace que el envío se reintente y se duplique, así que
 * este módulo expone la distinción explícitamente: `enProceso` frente a
 * `contenido`.
 *
 * Se construye el sobre a mano con el mismo criterio que `sunat-soap.client.ts`
 * (document/literal, una sola operación) para no añadir una librería SOAP.
 */
import {
  SUNAT_DEFAULT_TIMEOUT_MS,
  SUNAT_SEND_BILL_SOAP_ACTION,
} from './soap.constants';

/** Acciones SOAP de las dos operaciones. */
export const SEND_SUMMARY_SOAP_ACTION =
  'urn:oasis:names:specification:ubl:dsig:enveloped:xades';
export const GET_STATUS_SOAP_ACTION = SEND_SUMMARY_SOAP_ACTION;

/** Códigos de SUNAT que significan "todavía estoy procesando". */
export const CODIGOS_EN_PROCESO: readonly string[] = ['98', '99'];

/** Credenciales SOL para el encabezado WS-Security. */
export interface CredencialesSol {
  usuario: string;
  clave: string;
}

/** Parámetros de `sendSummary`. */
export interface SendSummaryParams {
  context?: IssuerContext;
  /** Nombre del ZIP: RUC-TIPO-CORRELATIVO.zip (RC-... o RA-...). */
  fileName: string;
  /** ZIP del XML ya firmado. */
  zip: Buffer;
  credentials?: CredencialesSol | null;
}

/** Resultado de `sendSummary`. */
export interface SendSummaryResult {
  /** Número de ticket con el que se consultará el CDR. */
  ticket: string | null;
  tiempoRespuestaMs: number;
  httpStatus: number;
  rawResponse: string;
}

/** Resultado de `getStatus`. */
export interface GetStatusResult {
  /** Código de SUNAT: 0 = aceptado, 98/99 = en proceso. */
  statusCode: string | null;
  /** true cuando SUNAT todavía está procesando (98 o 99). */
  enProceso: boolean;
  /** Contenido del CDR en Base64, cuando ya está listo. */
  contenido: string | null;
  tiempoRespuestaMs: number;
  httpStatus: number;
  rawResponse: string;
}

/** Escapa el texto que se interpola en el sobre. */
const esc = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Cabecera WS-Security con el usuario SOL (RUC + usuario). */
const cabeceraSeguridad = (
  ruc: string,
  credentiales: CredencialesSol | null | undefined,
): string => {
  if (!credentiales) return '';
  const usuario =
    ruc && !credentiales.usuario.startsWith(ruc)
      ? ruc + credentiales.usuario
      : credentiales.usuario;

  return `<soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <wsse:UsernameToken>
          <wsse:Username>${esc(usuario)}</wsse:Username>
          <wsse:Password>${esc(credentiales.clave)}</wsse:Password>
        </wsse:UsernameToken>
      </wsse:Security>
    </soapenv:Header>`;
};

/** Sobre SOAP de `sendSummary`. */
export const construirSobreSendSummary = (params: {
  fileName: string;
  contentFileBase64: string;
  credentials?: CredencialesSol | null;
  ruc?: string;
}): string => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  ${cabeceraSeguridad(params.ruc ?? '', params.credentials)}
  <soapenv:Body>
    <ser:sendSummary>
      <fileName>${esc(params.fileName)}</fileName>
      <contentFile>${params.contentFileBase64}</contentFile>
    </ser:sendSummary>
  </soapenv:Body>
</soapenv:Envelope>`;

/** Sobre SOAP de `getStatus`. */
export const construirSobreGetStatus = (params: {
  ticket: string;
  credentials?: CredencialesSol | null;
  ruc?: string;
}): string => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  ${cabeceraSeguridad(params.ruc ?? '', params.credentials)}
  <soapenv:Body>
    <ser:getStatus>
      <ticket>${esc(params.ticket)}</ticket>
    </ser:getStatus>
  </soapenv:Body>
</soapenv:Envelope>`;

/**
 * Extrae el primer valor de una etiqueta, con o sin prefijo de namespace.
 *
 * No se usa un parser XML porque el sobre de respuesta de SUNAT llega como
 * texto y solo se necesitan dos campos; cargar un DOM completo por respuesta en
 * el worker sería desproporcionado.
 */
export const extraerEtiqueta = (
  xml: string,
  etiqueta: string,
): string | null => {
  const patron = new RegExp(
    `<(?:\\w+:)?${etiqueta}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${etiqueta}>`,
    'i',
  );
  const coincidencia = patron.exec(xml);
  return coincidencia ? coincidencia[1].trim() : null;
};

/** Lee la respuesta de `sendSummary` y devuelve el ticket. */
export const parseSendSummaryResponse = (
  xml: string,
): { ticket: string | null; fault: string | null } => {
  const fault = extraerEtiqueta(xml, 'faultstring');
  if (fault) return { ticket: null, fault };

  const ticket = extraerEtiqueta(xml, 'ticket');
  return { ticket: ticket && ticket.length > 0 ? ticket : null, fault: null };
};

/** Lee la respuesta de `getStatus`. */
export const parseGetStatusResponse = (
  xml: string,
): {
  statusCode: string | null;
  enProceso: boolean;
  contenido: string | null;
  fault: string | null;
} => {
  const fault = extraerEtiqueta(xml, 'faultstring');
  if (fault) {
    return { statusCode: null, enProceso: false, contenido: null, fault };
  }

  const statusCode = extraerEtiqueta(xml, 'statusCode');
  const contenido = extraerEtiqueta(xml, 'content');

  return {
    statusCode,
    // 98/99 son "todavía procesando": NO es un error y no debe reintentarse el
    // envío, solo volver a preguntar más tarde.
    enProceso: statusCode !== null && CODIGOS_EN_PROCESO.includes(statusCode),
    contenido: contenido && contenido.length > 0 ? contenido : null,
    fault: null,
  };
};

/** Error de transporte del billService (timeout, DNS, conexión cortada). */
export class SunatSummaryTransportError extends Error {
  readonly reintentable = true;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SunatSummaryTransportError';
  }
}

/**
 * Cliente de las dos operaciones que faltaban.
 *
 * Se separa de `SunatSoapClient` para no tocar un archivo que ya usan los flujos
 * de TA-28 y TA-30: agregar métodos a una clase con esa cobertura y esos tests
 * obliga a revisar todas sus dependencias en cada cambio.
 */
export class SunatSummaryClient {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = SUNAT_DEFAULT_TIMEOUT_MS,
  ) {}

  /** Envía el resumen o la baja y devuelve el número de ticket. */
  public async sendSummary(
    params: SendSummaryParams,
  ): Promise<SendSummaryResult> {
    const sobre = construirSobreSendSummary({
      fileName: params.fileName,
      contentFileBase64: params.zip.toString('base64'),
      credentials: params.credentials,
      ruc: params.fileName.split('-')[0],
    });

    const { respuesta, crudo, ms } = await this.post(sobre, params.context);
    const { ticket, fault } = parseSendSummaryResponse(crudo);

    if (fault) {
      throw new SunatSummaryTransportError(`Fault de SUNAT: ${fault}`);
    }
    if (!respuesta.ok) {
      throw new SunatSummaryTransportError(
        `El billService respondió HTTP ${respuesta.status} sin ticket`,
      );
    }

    return {
      ticket,
      tiempoRespuestaMs: ms,
      httpStatus: respuesta.status,
      rawResponse: crudo,
    };
  }

  /** Pregunta por el estado de un ticket. */
  public async getStatus(
    ticket: string,
    credentials?: CredencialesSol | null,
    context?: IssuerContext,
  ): Promise<GetStatusResult> {
    const sobre = construirSobreGetStatus({ ticket, credentials });
    const { respuesta, crudo, ms } = await this.post(sobre, context);
    const parsed = parseGetStatusResponse(crudo);

    if (parsed.fault) {
      throw new SunatSummaryTransportError(`Fault de SUNAT: ${parsed.fault}`);
    }

    return {
      statusCode: parsed.statusCode,
      enProceso: parsed.enProceso,
      contenido: parsed.contenido,
      tiempoRespuestaMs: ms,
      httpStatus: respuesta.status,
      rawResponse: crudo,
    };
  }

  /** POST al billService con la misma política de timeout que `sendBill`. */
  private async post(
    sobre: string,
    context?: IssuerContext,
  ): Promise<{
    respuesta: Response;
    crudo: string;
    ms: number;
  }> {
    const inicio = Date.now();

    try {
      const respuesta = await fetch(context?.endpoint ?? this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${SUNAT_SEND_BILL_SOAP_ACTION}"`,
          'Content-Length': String(Buffer.byteLength(sobre, 'utf8')),
        },
        body: sobre,
        // Sin este timeout, un cuelgue de SUNAT bloquea el worker hasta 300 s
        // por el headersTimeout de undici.
        signal: AbortSignal.timeout(context?.timeoutMs ?? this.timeoutMs),
      });

      const crudo = await respuesta.text();
      return { respuesta, crudo, ms: Date.now() - inicio };
    } catch (error) {
      const nombre =
        error && typeof error === 'object' && 'name' in error
          ? String((error as { name: unknown }).name)
          : '';

      if (nombre === 'TimeoutError' || nombre === 'AbortError') {
        throw new SunatSummaryTransportError(
          `Timeout de ${this.timeoutMs} ms esperando al billService`,
          error,
        );
      }

      throw new SunatSummaryTransportError(
        `Error de red contra el billService: ${(error as Error).message ?? nombre}`,
        error,
      );
    }
  }
}
