/**
 * Contrato SOAP del billService de SUNAT (envio individual de comprobantes).
 *
 * FUENTES VERIFICADAS (no de memoria):
 *  - Endpoints: constantes.properties del facturador oficial SUNAT SFS v2.5
 *    (sunat_archivos/sfs/VALI/constantes.properties, clave RUTA_SERV_CDP).
 *  - Namespaces, operacion y SOAPAction: WSDL oficial del billService
 *    (<endpoint>?wsdl) y sus documentos XSD asociados.
 *
 * OJO: el WSDL declara DOS namespaces distintos y confundirlos es el error de
 * integracion mas comun de este servicio:
 *   1. definitions@targetNamespace = http://service.gem.factura.comppago...
 *      Es el namespace del documento WSDL. NO se usa en el sobre.
 *   2. El namespace del portType, de los mensajes y de los elementos
 *      sendBill / sendBillResponse = http://service.sunat.gob.pe
 *      ESTE es el que va en el <soapenv:Body>.
 */

/** Namespace de los elementos sendBill / sendBillResponse dentro del Body. */
export const SUNAT_SERVICE_NAMESPACE = 'http://service.sunat.gob.pe';

/** Envoltura SOAP 1.1. Es la unica que publica beta y la recomendada. */
export const SOAP_ENVELOPE_NAMESPACE =
  'http://schemas.xmlsoap.org/soap/envelope/';

/** Prefijo del Body, igual al que usa el facturador oficial. */
export const SUNAT_SERVICE_PREFIX = 'ser';

/** Valor del encabezado HTTP SOAPAction para la operacion sendBill. */
export const SUNAT_SEND_BILL_SOAP_ACTION = 'urn:sendBill';

/**
 * WS-Security (SOAP Message Security 1.0).
 * El billService exige UsernameToken: el catalogo oficial de SUNAT incluye el
 * codigo 0101 "El encabezado de seguridad es incorrecto" y el 0102 "Usuario o
 * contrasena incorrectos", que solo tienen sentido si las credenciales viajan
 * dentro del sobre.
 */
export const WSSE_NAMESPACE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

/**
 * Tipo de contrasena PasswordText. La clave SOL viaja en claro dentro del
 * sobre, protegida por TLS.
 */
export const WSSE_PASSWORD_TYPE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText';

/** Endpoints por entorno. Son los mismos del facturador oficial. */
export const SUNAT_BILL_SERVICE_URLS = {
  /** Produccion. */
  produccion: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
  /** Beta (homologacion): no tiene efectos tributarios. */
  beta: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
} as const;

/** Timeout por defecto de la peticion SOAP, en milisegundos. */
export const SUNAT_DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Arma el nombre del ZIP que espera SUNAT: RUC-TIPO-SERIE-CORRELATIVO.zip
 *
 * El correlativo va SIN ceros de relleno (el nombre real es F001-1.zip),
 * mientras que el cbc:ID interno del XML si va a 8 digitos (F001-00000001).
 * Mezclar ambas convenciones produce los codigos 1034/1035/1036/1049/0161,
 * asi que el nombre se construye en un unico lugar.
 */
export function buildZipFileName(params: {
  ruc: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
}): string {
  const tipo = params.tipoComprobante.padStart(2, '0');
  const serie = params.serie.trim().toUpperCase();
  return `${params.ruc}-${tipo}-${serie}-${params.correlativo}.zip`;
}
