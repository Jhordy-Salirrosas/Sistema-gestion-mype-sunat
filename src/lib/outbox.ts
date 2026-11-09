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
  idempotencyKey?: string;
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

export interface PendingDailySummary {
  id: string;
  type: 'DAILY_SUMMARY';
  payload: { fecha: string };
  createdAt: string;
  attempts: number;
  status?: 'PENDING' | 'FAILED';
  nextAttemptAt?: string;
  lastError?: string;
}

export type PendingOperation = PendingAccountingEntry | PendingInvoiceEmission | PendingPartnerCreate | PendingDailySummary;

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

/** Encola el resumen diario de boletas cuando no hay red. */
export async function enqueueDailySummary(fecha: string): Promise<string> {
  const id = uuid();
  escribir([
    ...leer(),
    {
      id,
      type: 'DAILY_SUMMARY',
      payload: { fecha },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
    },
  ]);
  window.dispatchEvent(new Event('outbox:changed'));
  return id;
}

/** Conserva la clave del intento online al transferirlo a la cola persistente. */
export async function enqueueInvoiceEmission(
  payload: EmitirComprobantePayload,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<string> {
  const id = uuid();
  escribir([
    ...leer(),
    {
      id,
      type: 'INVOICE_EMISSION',
      idempotencyKey,
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

/** Quita una operación que el usuario decidió no enviar. */
export async function discardOperation(id: string): Promise<void> {
  escribir(leer().filter((item) => item.id !== id));
  window.dispatchEvent(new Event('outbox:changed'));
}

/** Vuelve a habilitar una operación FAILED para el próximo intento. */
export async function retryOperation(id: string): Promise<void> {
  escribir(
    leer().map((item) =>
      item.id === id
        ? { ...item, status: 'PENDING' as const, nextAttemptAt: undefined, lastError: undefined }
        : item,
    ),
  );
  window.dispatchEvent(new Event('outbox:changed'));
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
        await invoicesApi.emitirComprobante(operacion.payload, operacion.idempotencyKey ?? operacion.id);
      } else if (operacion.type === 'DAILY_SUMMARY') {
        await invoicesApi.enviarResumenDiario(operacion.payload.fecha);
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

/** Arranca la sincronización periódica y al recuperar la conexión. */
export function startOutboxSync(intervalMs = 30_000): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const sincronizar = () => void flushOutbox();
  const timer = window.setInterval(sincronizar, intervalMs);
  window.addEventListener('online', sincronizar);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', sincronizar);
  };
}
