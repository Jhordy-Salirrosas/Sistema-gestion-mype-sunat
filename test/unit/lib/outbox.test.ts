import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueAccountingEntry, enqueueInvoiceEmission, enqueuePartnerCreate, flushOutbox, listPendingOperations } from '@/lib/outbox';
import { accountingApi } from '@/modules/accounting/services/accountingApi';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';

vi.mock('@/modules/accounting/services/accountingApi', () => ({
  accountingApi: { createEntry: vi.fn() },
}));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({
  invoicesApi: { emitirComprobante: vi.fn() },
}));
vi.mock('@/modules/customs/services/masterDataApi', () => ({
  masterDataApi: { createPartner: vi.fn() },
}));

const payload = {
  period: '2026-11',
  entryDate: '2026-11-06',
  glosa: 'Asiento offline',
  sourceModule: 'MANUAL',
  lines: [
    { lineOrder: 1, accountCode: '12121', accountName: 'CxC', debitAmount: 100, creditAmount: 0 },
    { lineOrder: 2, accountCode: '70121', accountName: 'Ventas', debitAmount: 0, creditAmount: 100 },
  ],
};

describe('outbox de asientos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('encola con idempotencyKey y lista pendientes', async () => {
    const id = await enqueueAccountingEntry(payload);
    const pendientes = await listPendingOperations();

    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].type).toBe('ACCOUNTING_ENTRY');
    if (pendientes[0].type === 'ACCOUNTING_ENTRY') {
      expect(pendientes[0].payload.idempotencyKey).toBe(id);
    }
  });

  it('envía y elimina la operación al sincronizar', async () => {
    (accountingApi.createEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'entry-1' });
    await enqueueAccountingEntry(payload);

    await expect(flushOutbox()).resolves.toEqual({ enviados: 1, fallidos: 0 });
    expect(accountingApi.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(await listPendingOperations()).toHaveLength(0);
  });

  it('conserva la operación y cuenta el intento si falla', async () => {
    (accountingApi.createEntry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sin red'));
    await enqueueAccountingEntry(payload);

    await expect(flushOutbox()).resolves.toEqual({ enviados: 0, fallidos: 1 });
    const pendientes = await listPendingOperations();
    expect(pendientes[0].attempts).toBe(1);
    expect(pendientes[0].lastError).toBe('sin red');
  });

  it('no intenta sincronizar si el navegador está offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await enqueueAccountingEntry(payload);

    await expect(flushOutbox()).resolves.toEqual({ enviados: 0, fallidos: 0 });
    expect(accountingApi.createEntry).not.toHaveBeenCalled();
  });

  it('encola y sincroniza una emisión de comprobante', async () => {
    (invoicesApi.emitirComprobante as ReturnType<typeof vi.fn>).mockResolvedValue({ numero: 'F001-1' });
    await enqueueInvoiceEmission({ tipo: '01' } as never);

    await expect(flushOutbox()).resolves.toEqual({ enviados: 1, fallidos: 0 });
    expect(invoicesApi.emitirComprobante).toHaveBeenCalled();
  });

  it('marca FAILED un 4xx y no lo reintenta sin forzar', async () => {
    (accountingApi.createEntry as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 400 },
      message: 'datos inválidos',
    });
    await enqueueAccountingEntry(payload);

    await flushOutbox();
    const [fallida] = await listPendingOperations();
    expect(fallida.status).toBe('FAILED');

    await flushOutbox();
    expect(accountingApi.createEntry).toHaveBeenCalledTimes(1);

    (accountingApi.createEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ok' });
    await flushOutbox(true);
    expect(accountingApi.createEntry).toHaveBeenCalledTimes(2);
  });

  it('un 5xx queda PENDING con espera antes del próximo intento', async () => {
    (accountingApi.createEntry as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 503 },
      message: 'servicio no disponible',
    });
    await enqueueAccountingEntry(payload);

    await flushOutbox();
    const [pendiente] = await listPendingOperations();
    expect(pendiente.status).toBe('PENDING');
    expect(pendiente.nextAttemptAt).toBeTruthy();
    expect(accountingApi.createEntry).toHaveBeenCalledTimes(1);

    await flushOutbox();
    expect(accountingApi.createEntry).toHaveBeenCalledTimes(1);
  });

  it('encola y sincroniza el alta de un cliente', async () => {
    (masterDataApi.createPartner as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p-1' });
    await enqueuePartnerCreate({ docNumber: '20100070970', legalName: 'CLIENTE SAC' });

    await expect(flushOutbox()).resolves.toEqual({ enviados: 1, fallidos: 0 });
    expect(masterDataApi.createPartner).toHaveBeenCalledWith({
      docNumber: '20100070970',
      legalName: 'CLIENTE SAC',
    });
  });
});
