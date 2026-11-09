import { sendInvoice } from '@/modules/resilience/services/invoiceIngestApi';
import { beforeEach, expect, it, vi } from 'vitest';
import { enqueue, closeOfflineQueue, listAll } from '@/modules/resilience/services/offlineQueue';
import { syncPending, retryOne } from '@/modules/resilience/services/offlineQueueSyncer';
import { apiClient } from '@/lib/axios';
import { enqueueInvoiceEmission, flushOutbox, listPendingOperations, retryOperation } from '@/lib/outbox';

const { rows, db } = vi.hoisted(() => {
  const rows = new Map<string, any>();
  return { rows, db: {
    add: vi.fn(async (_: string, item: any) => { rows.set(item.id, structuredClone(item)); }),
    put: vi.fn(async (_: string, item: any) => { rows.set(item.id, structuredClone(item)); }),
    get: vi.fn(async (_: string, id: string) => structuredClone(rows.get(id))),
    getAllFromIndex: vi.fn(async (_: string, index: string, status?: string) => [...rows.values()].filter(item => index !== 'by-status' || item.status === status).map(item => structuredClone(item))),
    close: vi.fn(),
  } };
});
vi.mock('idb', () => ({ openDB: vi.fn(async () => db) }));
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));
const payload = { ruc_emisor: '20100070970', serie: 'F001', correlativo: 1, tipo_comprobante: '01', monto_total: 118, fecha_emision: '2026-11-08', payload_ubl: {} };
beforeEach(async () => { await closeOfflineQueue(); rows.clear(); localStorage.clear(); vi.clearAllMocks(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
it('persiste la clave al encolar; conserva el UUID tras recargar, fallo de red y reintento manual', async () => {
  const item = await enqueue(payload);
  const otro = await enqueue({ ...payload, correlativo: 2 });
  expect(item.id).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  expect(otro.id).not.toBe(item.id);
  await closeOfflineQueue();
  expect((await listAll())[0].id).toBe(item.id);
  vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true });
  await syncPending();
  await retryOne(item.id);
  vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'accepted' } });
  await syncPending();
  expect(vi.mocked(apiClient.post).mock.calls[0]).toEqual(vi.mocked(apiClient.post).mock.calls[1]);
  expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ headers: { 'Idempotency-Key': item.id } });
});
it('preserva la clave de un envío online al pasarlo a IndexedDB', async () => {
  const clave = crypto.randomUUID();
  await enqueue(payload, clave);
  vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'accepted' } });
  await syncPending();
  expect(apiClient.post).toHaveBeenCalledWith('/invoices', payload, { headers: { 'Idempotency-Key': clave } });
});
it('un conflicto 409 conserva el payload offline y lo marca fallido', async () => {
  const item = await enqueue(payload);
  vi.mocked(apiClient.post).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  await syncPending();
  expect((await listAll())[0]).toMatchObject({ id: item.id, payload, status: 'FALLIDO', lastError: expect.stringContaining('409') });
});
it('la Outbox conserva clave y cuerpo al serializar y reintentar un 5xx y un 409', async () => {
  const clave = crypto.randomUUID();
  const id = await enqueueInvoiceEmission(payload as never, clave);
  vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 503 } }).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValue({ data: {} });
  await flushOutbox();
  await retryOperation(id);
  await flushOutbox();
  expect((await listPendingOperations())[0]).toMatchObject({ payload, idempotencyKey: clave, status: 'FAILED' });
  await retryOperation(id);
  await flushOutbox();
  const calls = vi.mocked(apiClient.post).mock.calls;
  expect(calls).toHaveLength(3);
  expect(calls[1]).toEqual(calls[0]); expect(calls[2]).toEqual(calls[0]);
  expect(calls[0][2]).toEqual({ headers: { 'Idempotency-Key': clave } });
  expect(await listPendingOperations()).toHaveLength(0);
});

  it('envía la misma clave persistida en cada reintento de ingesta', async () => {
    const clave = crypto.randomUUID();
    await sendInvoice(payload, clave);
    await sendInvoice(payload, clave);
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/invoices', payload, { headers: { 'Idempotency-Key': clave } });
    expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(vi.mocked(apiClient.post).mock.calls[0]);
  });
  it('no confunde un conflicto de idempotencia de ingesta con un alta exitosa', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    expect(await sendInvoice(payload, crypto.randomUUID())).toMatchObject({ kind: 'RECHAZADO', detail: expect.stringContaining('409') });
  });
