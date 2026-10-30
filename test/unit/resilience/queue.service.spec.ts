/**
 * HU-04 — pruebas unitarias de la DLQ de pg-boss.
 *
 * El `PgBoss` real solo se usa como transporte en producción. Aquí se
 * reemplaza por un doble para verificar el contrato de `sendToDlq`, el mapeo
 * que consume el panel y el manejo de errores sin depender de PostgreSQL.
 */
import {
  INVOICE_DLQ,
  QueueService,
} from '../../../src/modules/resilience/infrastructure/queue/queue.service';

interface BossMock {
  send: jest.Mock;
  findJobs: jest.Mock;
  retry: jest.Mock;
}

function crearServicio(): { service: QueueService; boss: BossMock } {
  const service = new QueueService();
  const boss: BossMock = {
    send: jest.fn(),
    findJobs: jest.fn(),
    retry: jest.fn(),
  };

  (service as unknown as { boss: BossMock }).boss = boss;

  return { service, boss };
}

describe('HU-04 · QueueService (DLQ)', () => {
  it('envía un job a la DLQ con el detalle y sin reintentos automáticos', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValue('dlq-job-1');

    const id = await service.sendToDlq('inv-1', 'company-a', {
      intento: 4,
      codigo_error: 'MAX_REINTENTOS',
    });

    expect(boss.send).toHaveBeenCalledWith(
      INVOICE_DLQ,
      {
        invoice_id: 'inv-1',
        company_id: 'company-a',
        intento: 4,
        codigo_error: 'MAX_REINTENTOS',
      },
      { retryLimit: 0 },
    );
    expect(id).toBe('dlq-job-1');
  });

  it('envía un job a la DLQ sin detalle adicional', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValue('dlq-job-2');

    await service.sendToDlq('inv-2', 'company-b');

    expect(boss.send).toHaveBeenCalledWith(
      INVOICE_DLQ,
      { invoice_id: 'inv-2', company_id: 'company-b' },
      { retryLimit: 0 },
    );
  });

  it('incluye el company_id obtenido dentro de la transacción al encolar', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValue('queue-job-1');
    const tx = {
      $queryRawUnsafe: jest.fn(),
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ company_id: 'company-a' }),
      },
    };

    await service.enqueueInvoiceInTx(tx, 'invoice-a');

    expect(tx.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'invoice-a' },
      select: { company_id: true },
    });
    expect(boss.send).toHaveBeenCalledWith(
      'sunat-invoice-queue',
      { invoice_id: 'invoice-a', company_id: 'company-a' },
      expect.objectContaining({ db: expect.anything() }),
    );
  });

  it('mapea los jobs de la DLQ para el panel', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockResolvedValue([
      {
        id: 'dlq-1',
        retryCount: 0,
        data: {
          invoice_id: 'inv-1',
          company_id: 'company-a',
          intento: 4,
          codigo_error: 'MAX_REINTENTOS',
          mensaje_error: 'Reintentos agotados',
          estado: 'ERROR_RED',
        },
      },
      {
        id: 'dlq-2',
        retryCount: 2,
        data: { company_id: 'company-a' },
      },
      {
        id: 'dlq-other-company',
        retryCount: 1,
        data: {
          invoice_id: 'inv-other',
          company_id: 'company-b',
        },
      },
    ]);

    const items = await service.listDlq('company-a');

    expect(boss.findJobs).toHaveBeenCalledWith(INVOICE_DLQ, {
      data: { company_id: 'company-a' },
      queued: true,
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'dlq-1',
      comprobanteSerieNumero: 'inv-1',
      codigoErrorSunat: 'MAX_REINTENTOS',
      mensajeError: 'Reintentos agotados',
      intentosFallidos: 4,
      estado: 'ERROR_RED',
    });
    expect(items[1]).toMatchObject({
      id: 'dlq-2',
      comprobanteSerieNumero: 'sin identificar',
      codigoErrorSunat: '',
      mensajeError: 'El comprobante agoto los reintentos automaticos',
      intentosFallidos: 2,
      estado: 'ERROR_RED',
    });
  });

  it('propaga errores de pg-boss al listar la DLQ', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockRejectedValue(new Error('sin conexión'));

    await expect(service.listDlq('company-a')).rejects.toThrow('sin conexión');
  });

  it('cuenta los jobs en cola y propaga errores de pg-boss', async () => {
    const { service, boss } = crearServicio();

    boss.findJobs.mockResolvedValueOnce([{}, {}, {}]);
    await expect(service.countQueued()).resolves.toBe(3);

    boss.findJobs.mockRejectedValueOnce(new Error('sin conexión'));
    await expect(service.countQueued()).rejects.toThrow('sin conexión');
  });

  it('devuelve un job de la DLQ a la cola de reintento', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockResolvedValue([
      { data: { company_id: 'company-a' } },
    ]);

    await service.retryDlq('dlq-1', 'company-a');

    expect(boss.findJobs).toHaveBeenCalledWith(INVOICE_DLQ, {
      id: 'dlq-1',
      queued: true,
    });
    expect(boss.retry).toHaveBeenCalledWith(INVOICE_DLQ, 'dlq-1');
  });

  it('does not retry a DLQ job belonging to another company', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockResolvedValue([
      { data: { company_id: 'company-b' } },
    ]);

    await expect(service.retryDlq('dlq-1', 'company-a')).rejects.toThrow(
      'No se encontró el trabajo de DLQ.',
    );
    expect(boss.retry).not.toHaveBeenCalled();
  });

  it('exige DATABASE_URL para construir el servicio', () => {
    const original = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;
    try {
      expect(() => new QueueService()).toThrow('DATABASE_URL');
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});
