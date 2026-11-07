import { accountingApi } from '@/modules/accounting/services/accountingApi';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import type { CreateAccountingEntryInput } from '@/modules/accounting/types/accounting.types';
import type { EmitirComprobantePayload } from '@/modules/invoices/types/invoiceEmision.types';

export interface PendingAccountingEntry {
  id: string;
  type: 'ACCOUNTING_ENTRY';
  payload: CreateAccountingEntryInput;
  createdAt: string;
  attempts: number;
  status?: 'PENDING' | 'FAILED';
  nextAttemptAt?: string;
  lastError?: string;
}

export interface PendingInvoiceEmission {
  id: string;
  type: 'INVOICE_EMISSION';
  payload: EmitirComprobantePayload;
  createdAt: string;
  attempts: number;
  status?: 'PENDING' | 'FAILED';
  nextAttemptAt?: string;
  lastError?: string;
}

export interface PendingPartnerCreate {
  id: string;
  type: 'PARTNER_CREATE';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  status?: 'PENDING' | 'FAILED';
  nextAttemptAt?: string;
  lastError?: string;
}

export type PendingOperation = PendingAccountingEntry | PendingInvoiceEmission | PendingPartnerCreate;

const STORAGE_KEY = 'sync-sunat-outbox';

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function leer(): PendingOperation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
  } catch {
    return [];
  }
}

function escribir(operaciones: PendingOperation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(operaciones));
}

/** Guarda un asiento para enviarlo cuando vuelva la red. */
export async function enqueueAccountingEntry(
  payload: CreateAccountingEntryInput,
): Promise<string> {
  const id = uuid();
  const operacion: PendingAccountingEntry = {
    id,
    type: 'ACCOUNTING_ENTRY',
    payload: { ...payload, idempotencyKey: payload.idempotencyKey ?? id },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'PENDING',
  };
  escribir([...leer(), operacion]);
  window.dispatchEvent(new Event('outbox:changed'));
  return id;
}

/** Encola el alta de un cliente/proveedor cuando no hay red. */
export async function enqueuePartnerCreate(
  payload: Record<string, unknown>,
): Promise<string> {
  const id = uuid();
  escribir([
    ...leer(),
    {
      id,
      type: 'PARTNER_CREATE',
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
    },
  ]);
  window.dispatchEvent(new Event('outbox:changed'));
  return id;
}

/** Encola una emisión cuando no hay red; la llave fiscal evita duplicados. */
export async function enqueueInvoiceEmission(
  payload: EmitirComprobantePayload,
): Promise<string> {
  const id = uuid();
  escribir([
    ...leer(),
    {
      id,
      type: 'INVOICE_EMISSION',
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
    },
  ]);
  window.dispatchEvent(new Event('outbox:changed'));
  return id;
}

export async function listPendingOperations(): Promise<PendingOperation[]> {
  return leer();
}

const esperaMs = (attempts: number): number =>
  Math.min(5 * 60_000, 2 ** attempts * 1_000);

const esConflictoPermanente = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

/**
 * Reintenta la cola. Los errores 4xx se marcan FAILED porque reintentar no
 * cambia el resultado; los 5xx/red quedan PENDING con backoff exponencial.
 * `forzar` permite reintentar manualmente un FAILED desde la UI.
 */
export async function flushOutbox(
  forzar = false,
): Promise<{ enviados: number; fallidos: number }> {
  if (!navigator.onLine) return { enviados: 0, fallidos: 0 };
  const ahora = Date.now();
  let enviados = 0;
  let fallidos = 0;

  for (const operacion of leer()) {
    if (!forzar) {
      if (operacion.status === 'FAILED') continue;
      if (operacion.nextAttemptAt && new Date(operacion.nextAttemptAt).getTime() > ahora) continue;
    }

    try {
      if (operacion.type === 'ACCOUNTING_ENTRY') {
        await accountingApi.createEntry(operacion.payload);
      } else if (operacion.type === 'INVOICE_EMISSION') {
        await invoicesApi.emitirComprobante(operacion.payload);
      } else {
        await masterDataApi.createPartner(operacion.payload);
      }
      escribir(leer().filter((item) => item.id !== operacion.id));
      enviados += 1;
    } catch (error) {
      const intentos = operacion.attempts + 1;
      const permanente = esConflictoPermanente(error);
      escribir(
        leer().map((item) =>
          item.id === operacion.id
            ? {
                ...item,
                attempts: intentos,
                status: permanente ? ('FAILED' as const) : ('PENDING' as const),
                nextAttemptAt: permanente
                  ? undefined
                  : new Date(Date.now() + esperaMs(intentos)).toISOString(),
                lastError: error instanceof Error ? error.message : 'Error desconocido',
              }
            : item,
        ),
      );
      fallidos += 1;
    }
  }

  window.dispatchEvent(new Event('outbox:changed'));
  return { enviados, fallidos };
}
