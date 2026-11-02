/**
 * HU-04 · registro del worker de comprobantes y envío explícito a la DLQ.
 *
 * pg-boss entrega los jobs por lote; el worker fiscal procesa uno por vez
 * (`batchSize: 1`) porque el pipeline comparte correlativo y Circuit Breaker.
 */
import { Logger } from '@nestjs/common';
import {
  INVOICE_DLQ,
  INVOICE_QUEUE,
  QueueService,
} from '../../../src/modules/resilience/infrastructure/queue/queue.service';

interface BossMock {
  work: jest.Mock;
  send: jest.Mock;
}

function crearServicio(): { service: QueueService; boss: BossMock } {
  const service = new QueueService();
  const boss: BossMock = { work: jest.fn(), send: jest.fn() };
  (service as unknown as { boss: BossMock }).boss = boss;
  return { service, boss };
}

describe('HU-04 · QueueService (worker y DLQ explícita)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registra el worker de la cola fiscal y procesa un job por vez', async () => {
    const { service, boss } = crearServicio();
    boss.work.mockResolvedValue('worker-fiscal');
    const handler = jest.fn().mockResolvedValue(undefined);

    const id = await service.registerInvoiceWorker(handler);

    expect(id).toBe('worker-fiscal');
    expect(boss.work).toHaveBeenCalledWith(
      INVOICE_QUEUE,
      { batchSize: 1 },
      expect.any(Function),
    );
  });

  it('entrega al handler el payload del job y tolera un lote vacío', async () => {
    const { service, boss } = crearServicio();
    boss.work.mockResolvedValue('worker-fiscal');
    const handler = jest.fn().mockResolvedValue(undefined);

    await service.registerInvoiceWorker(handler);
    const procesarLote = boss.work.mock.calls[0][2] as (
      jobs: Array<{ data: { invoice_id: string } }>,
    ) => Promise<void>;

    await procesarLote([{ data: { invoice_id: 'inv-1' } }]);
    expect(handler).toHaveBeenCalledWith({ invoice_id: 'inv-1' });

    await procesarLote([]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('mueve el job a la DLQ con el motivo y la marca de tiempo', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValue('dlq-1');

    await service.moveToDlq({ invoice_id: 'inv-2' }, 'Se agotaron los reintentos');

    expect(boss.send).toHaveBeenCalledWith(
      INVOICE_DLQ,
      expect.objectContaining({
        invoice_id: 'inv-2',
        motivo: 'Se agotaron los reintentos',
        enviado_a_dlq_en: expect.any(String),
      }),
    );
  });

  it('registra el error y no propaga si la DLQ no responde', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockRejectedValue(new Error('pg-boss caído'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(
      () => undefined,
    );

    await expect(
      service.moveToDlq({ invoice_id: 'inv-3' }, 'fallo de DLQ'),
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo mover el comprobante inv-3'),
    );
  });
});
