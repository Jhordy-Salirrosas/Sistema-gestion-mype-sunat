import { InvoiceStatus } from '../../../generated/client/enums';
import { CdrClassification } from './cdr-classifier';
import { ParsedCdr } from './cdr.parser';
import {
  SUNAT_BILL_SERVICE_URLS,
  SUNAT_DEFAULT_TIMEOUT_MS,
} from './soap.constants';

export interface SendInvoiceParams {
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

export function resolveEndpoint(): string {
  if (process.env.SUNAT_BILL_SERVICE_URL) {
    return process.env.SUNAT_BILL_SERVICE_URL;
  }
  return process.env.SUNAT_ENV === 'produccion'
    ? SUNAT_BILL_SERVICE_URLS.produccion
    : SUNAT_BILL_SERVICE_URLS.beta;
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
