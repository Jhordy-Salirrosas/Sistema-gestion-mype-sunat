import { InvoiceQueueReconciler } from '../../../src/modules/resilience/application/invoiceQueueReconciler';
import { InvoiceStatus } from '../../../src/generated/client/enums';

describe('InvoiceQueueReconciler (D12)', () => {
  const prisma = {
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const queue = { reenqueueInvoiceIfIdle: jest.fn() };
  const circuit = { puedeEnviar: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    circuit.puedeEnviar.mockReturnValue(true);
  });

  it('reencola comprobantes EN_COLA sin job vivo', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', company_id: 'comp-1' },
    ]);
    prisma.invoice.findUnique.mockResolvedValue({ estado: InvoiceStatus.EN_COLA });
    queue.reenqueueInvoiceIfIdle.mockResolvedValue({ estado: 'ENCOLADO' });

    const reconciler = new InvoiceQueueReconciler(
      prisma as never,
      queue as never,
      circuit as never,
    );

    await expect(reconciler.reconciliar()).resolves.toEqual({
      revisados: 1,
      encolados: 1,
    });
    expect(queue.reenqueueInvoiceIfIdle).toHaveBeenCalledWith(
      'inv-1',
      'comp-1',
      expect.any(Function),
    );
  });

  it('no hace nada si el circuito está abierto', async () => {
    circuit.puedeEnviar.mockReturnValue(false);
    const reconciler = new InvoiceQueueReconciler(
      prisma as never,
      queue as never,
      circuit as never,
    );

    await expect(reconciler.reconciliar()).resolves.toEqual({
      revisados: 0,
      encolados: 0,
    });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('no cuenta como encolado si ya tenía job', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', company_id: 'comp-1' },
    ]);
    prisma.invoice.findUnique.mockResolvedValue({ estado: InvoiceStatus.EN_COLA });
    queue.reenqueueInvoiceIfIdle.mockResolvedValue({ estado: 'YA_EN_COLA' });
    const reconciler = new InvoiceQueueReconciler(
      prisma as never,
      queue as never,
      circuit as never,
    );

    await expect(reconciler.reconciliar()).resolves.toEqual({
      revisados: 1,
      encolados: 0,
    });
  });
});
