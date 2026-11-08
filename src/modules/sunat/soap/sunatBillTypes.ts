import type { IssuerContext } from '../issuerConfigResolver';
import { InvoiceStatus } from '../../../generated/client/enums';
import { CdrClassification } from './cdr-classifier';
import { ParsedCdr } from './cdr.parser';
import {
  SUNAT_BILL_SERVICE_URLS,
  SUNAT_DEFAULT_TIMEOUT_MS,
} from './soap.constants';

export interface SendInvoiceParams {
  companyId?: string;
  context?: IssuerContext;
  invoiceId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  /** ZIP con el XML firmado, listo para enviar. */
  zip: Buffer;
  /** Estado actual del comprobante (para la auditoría del historial). */
  estadoActual?: InvoiceStatus | null;
  /** Número de intento. */
  intento?: number;
}

export interface ProcessCdrResult {
  invoiceId: string;
  responseCode: string;
  estado: InvoiceStatus;
  valido: boolean;
  reintentable: boolean;
  clasificacion: CdrClassification;
  cdr: ParsedCdr | null;
  tiempoRespuestaMs: number | null;
  error: string | null;
}

export type EntornoSunat = 'MOCK' | 'BETA' | 'PRODUCCION';
export function normalizarEntorno(value: string | undefined | null): EntornoSunat | null {
  const env = value?.trim().toUpperCase();
  if (env === 'PRODUCTION' || env === 'PRODUCCION') return 'PRODUCCION';
  return env === 'MOCK' || env === 'BETA' ? env : null;
}

/** La configuración ausente no declara MOCK ni apunta implícitamente a BETA. */
export function resolveEndpoint(): string {
  if (process.env.SUNAT_BILL_SERVICE_URL) return process.env.SUNAT_BILL_SERVICE_URL;
  const env = normalizarEntorno(process.env.SUNAT_ENV);
  if (env === 'PRODUCCION') return process.env.SUNAT_BILL_SERVICE_URL_PRODUCCION ?? SUNAT_BILL_SERVICE_URLS.produccion;
  if (env === 'BETA') return process.env.SUNAT_BILL_SERVICE_URL_BETA ?? SUNAT_BILL_SERVICE_URLS.beta;
  return '';
}

/** Valida el destino antes de enviar secretos. Un entorno no autoriza otro. */
export function endpointCoherente(env: EntornoSunat | null, endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.username || url.password || url.hash || url.search) return false;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (env === 'MOCK') return local && ['http:', 'https:'].includes(url.protocol);
    if (url.protocol !== 'https:') return false;
    return (env === 'BETA' && url.hostname === 'e-beta.sunat.gob.pe') ||
      (env === 'PRODUCCION' && url.hostname === 'e-factura.sunat.gob.pe');
  } catch { return false; }
}

export function resolveTimeout(): number {
  const raw = Number(process.env.SUNAT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : SUNAT_DEFAULT_TIMEOUT_MS;
}

export function buildSolUsername(rucEmisor: string): string | null {
  const solUser = process.env.SUNAT_SOL_USER;
  if (!solUser) return null;
  return solUser.startsWith(rucEmisor) ? solUser : `${rucEmisor}${solUser}`;
}
