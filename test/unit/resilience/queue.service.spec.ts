/**
 * HU-04 — pruebas unitarias de la DLQ de pg-boss.
 *
 * El `PgBoss` real solo se usa como transporte en producción. Aquí se
 * reemplaza por un doble para verificar el contrato de `sendToDlq`, el mapeo
 * que consume el panel y el manejo de errores sin depender de PostgreSQL.
 */
import {
  INVOICE_DLQ,
  INVOICE_QUEUE,
  SIRE_PERIODS_DLQ,
  SIRE_PERIODS_QUEUE,
  QueueService,
} from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { ServiceUnavailableException } from '@nestjs/common';

interface BossMock {
  send: jest.Mock;
  findJobs: jest.Mock;
  retry: jest.Mock;
  on: jest.Mock;
  start: jest.Mock;
  createQueue: jest.Mock;
  updateQueue: jest.Mock;
  deleteJob: jest.Mock;
  stop: jest.Mock;
  work: jest.Mock;
}

function crearServicio(): { service: QueueService; boss: BossMock } {
  const service = new QueueService();
  const boss: BossMock = {
    send: jest.fn(),
    findJobs: jest.fn(),
    retry: jest.fn(),
    on: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    createQueue: jest.fn().mockResolvedValue(undefined),
    updateQueue: jest.fn().mockResolvedValue(undefined),
    deleteJob: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue('worker-id'),
  };

  (service as unknown as { boss: BossMock }).boss = boss;

  return { service, boss };
}

describe('HU-04 · QueueService (DLQ)', () => {
  it('initializes the SIRE queues with retries and a dead-letter queue', async () => {
    const { service, boss } = crearServicio();

    await service.onModuleInit();

    expect(boss.createQueue).toHaveBeenCalledWith(SIRE_PERIODS_DLQ, {
      retryLimit: 0,
    });
    expect(boss.createQueue).toHaveBeenCalledWith(SIRE_PERIODS_QUEUE, {
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      retryDelayMax: 300,
      deadLetter: SIRE_PERIODS_DLQ,
    });
  });

  it('registers the SIRE periods worker with PgBoss', async () => {
    const { service, boss } = crearServicio();
    const handler = jest.fn().mockResolvedValue(undefined);

    await expect(service.registerSirePeriodsWorker(handler)).resolves.toBe(
      'worker-id',
    );

    expect(boss.work).toHaveBeenCalledWith(
      SIRE_PERIODS_QUEUE,
      { batchSize: 1 },
      expect.any(Function),
    );
  });

  it('entrega el trabajo de SIRE al manejador registrado', async () => {
    const { service, boss } = crearServicio();
    const handler = jest.fn().mockResolvedValue(undefined);
    const job = {
      messageId: 'message-1',
      companyId: 'company-a',
      ruc: '20100070970',
      bookCode: '140000' as const,
      encryptedSolCredentials: 'cifrado',
    };

    await service.registerSirePeriodsWorker(handler);
    const worker = (boss.work as jest.Mock).mock.calls.at(-1)?.[2] as (
      jobs: Array<{ data: typeof job }>,
    ) => Promise<void>;
    await worker([{ data: job }]);

    expect(handler).toHaveBeenCalledWith(job);
  });

  it('entrega el trabajo de la DLQ de SIRE al manejador registrado', async () => {
    const { service, boss } = crearServicio();
    const handler = jest.fn().mockResolvedValue(undefined);
    const job = {
      messageId: 'message-1',
      companyId: 'company-a',
      ruc: '20100070970',
      bookCode: '140000' as const,
      encryptedSolCredentials: 'cifrado',
    };

    await service.registerSirePeriodsDlqWorker(handler);
    const worker = (boss.work as jest.Mock).mock.calls.at(-1)?.[2] as (
      jobs: Array<{ data: typeof job }>,
    ) => Promise<void>;
    await worker([{ data: job }]);

    expect(handler).toHaveBeenCalledWith(job);
  });

  it('encola la consulta SIRE con el identificador del mensaje', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValue('sire-job-1');
    const job = {
      messageId: 'message-1',
      companyId: 'company-a',
      ruc: '20100070970',
      bookCode: '140000' as const,
      encryptedSolCredentials: 'cifrado',
    };

    await expect(service.enqueueSirePeriods(job)).resolves.toBe('sire-job-1');

    expect(boss.send).toHaveBeenCalledWith(SIRE_PERIODS_QUEUE, job, {
      id: 'message-1',
    });
  });

  it('no filtra el error de pg-boss al encolar una consulta SIRE', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockRejectedValue(
      new Error('password authentication failed for user postgres'),
    );

    const failure = await service
      .enqueueSirePeriods({
        messageId: 'message-1',
        companyId: 'company-a',
        ruc: '20100070970',
        bookCode: '140000',
        encryptedSolCredentials: 'cifrado',
      })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    const serialized = JSON.stringify(
      (failure as ServiceUnavailableException).getResponse(),
    );
    expect(serialized).not.toContain('postgres');
    expect(serialized).not.toContain('password authentication failed');
  });

  it('informa la indisponibilidad de la cola SIRE cuando PgBoss está en bypass', async () => {
    const { service, boss } = crearServicio();
    (service as unknown as { bypass: boolean }).bypass = true;

    const failure = await service
      .enqueueSirePeriods({
        messageId: 'message-1',
        companyId: 'company-a',
        ruc: '20100070970',
        bookCode: '140000',
        encryptedSolCredentials: 'cifrado',
      })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect(boss.send).not.toHaveBeenCalled();
  });

  it('informa la indisponibilidad de la cola SIRE cuando PgBoss no devuelve id', async () => {
    const { service, boss } = crearServicio();
    boss.send.mockResolvedValueOnce(null);

    const failure = await service
      .enqueueSirePeriods({
        messageId: 'message-1',
        companyId: 'company-a',
        ruc: '20100070970',
        bookCode: '140000',
        encryptedSolCredentials: 'cifrado',
      })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
  });

  it('no registra el worker de SIRE cuando PgBoss está en bypass', async () => {
    const { service, boss } = crearServicio();
    (service as unknown as { bypass: boolean }).bypass = true;

    await expect(
      service.registerSirePeriodsWorker(jest.fn()),
    ).resolves.toBe('');
    await expect(
      service.registerSirePeriodsDlqWorker(jest.fn()),
    ).resolves.toBe('');
    expect(boss.work).not.toHaveBeenCalled();
  });

  it('lista solo los trabajos de resumen de la DLQ de la empresa', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockResolvedValueOnce([
      {
        id: 'job-1',
        retryCount: 3,
        data: {
          tipo: 'RESUMEN_DIARIO',
          identificador: 'RC-20261101-001',
          companyId: 'company-a',
        },
      },
      {
        id: 'job-2',
        retryCount: 1,
        data: {
          tipo: 'RESUMEN_DIARIO',
          identificador: 'RC-20261101-002',
          companyId: 'otra-empresa',
        },
      },
    ]);

    const resumenes = await service.listSummaryDlq('company-a');

    expect(resumenes).toEqual([
      {
        id: 'job-1',
        identificador: 'RC-20261101-001',
        tipo: 'RESUMEN_DIARIO',
        intentosFallidos: 3,
      },
    ]);
  });

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
      mensajeError: 'El comprobante agotó los reintentos automáticos',
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
      { data: { company_id: 'company-a', invoice_id: 'inv-1' } },
    ]);

    await service.retryDlq('dlq-1', 'company-a');

    expect(boss.findJobs).toHaveBeenCalledWith(INVOICE_DLQ, {
      id: 'dlq-1',
      queued: true,
    });
    expect(boss.send).toHaveBeenCalledWith(INVOICE_QUEUE, { invoice_id: 'inv-1', company_id: 'company-a' }, { singletonKey: 'invoice:inv-1' });
    expect(boss.deleteJob).toHaveBeenCalledWith(INVOICE_DLQ, 'dlq-1');
    expect(boss.retry).not.toHaveBeenCalled();
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

  describe('reenqueueInvoiceIfIdle', () => {
    it('encola con singletonKey cuando no hay job vivo ni DLQ', async () => {
      const { service, boss } = crearServicio();
      boss.findJobs.mockResolvedValue([]);
      boss.send.mockResolvedValue('job-nuevo');

      await expect(
        service.reenqueueInvoiceIfIdle('inv-1', 'company-a'),
      ).resolves.toEqual({ estado: 'ENCOLADO', jobId: 'job-nuevo' });

      expect(boss.send).toHaveBeenCalledWith(
        INVOICE_QUEUE,
        { invoice_id: 'inv-1', company_id: 'company-a' },
        { singletonKey: 'invoice:inv-1' },
      );
    });

    it('no duplica si ya hay un job vivo', async () => {
      const { service, boss } = crearServicio();
      boss.findJobs
        .mockResolvedValueOnce([{ id: 'job-vivo' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.reenqueueInvoiceIfIdle('inv-1', 'company-a'),
      ).resolves.toEqual({ estado: 'YA_EN_COLA' });
      expect(boss.send).not.toHaveBeenCalled();
    });

    it('no reencola si el comprobante está en DLQ', async () => {
      const { service, boss } = crearServicio();
      boss.findJobs
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'job-dlq' }]);

      await expect(
        service.reenqueueInvoiceIfIdle('inv-1', 'company-a'),
      ).resolves.toEqual({ estado: 'EN_DLQ' });
      expect(boss.send).not.toHaveBeenCalled();
    });

    it('respeta el callback de estado de M1', async () => {
      const { service, boss } = crearServicio();
      boss.findJobs.mockResolvedValue([]);

      await expect(
        service.reenqueueInvoiceIfIdle('inv-1', 'company-a', async () => false),
      ).resolves.toEqual({ estado: 'ESTADO_NO_PERMITIDO' });
      expect(boss.send).not.toHaveBeenCalled();
    });
  });
});it('un fallo al publicar el reintento conserva el trabajo original de DLQ', async () => {
  const { service, boss } = crearServicio();
  boss.findJobs.mockResolvedValue([{ data: { company_id: 'empresa', invoice_id: 'inv-1' } }]);
  boss.send.mockRejectedValue(new Error('fallo de cola'));
  await expect(service.retryDlq('dlq-1', 'empresa')).rejects.toThrow('fallo de cola');
  expect(boss.deleteJob).not.toHaveBeenCalled();
});
it('declara y actualiza la misma política recuperable en la cola principal existente', async () => {
  const { service, boss } = crearServicio();
  await service.onModuleInit();
  const policy = { retryLimit: 3, retryDelay: 60, retryBackoff: true, retryDelayMax: 300, deadLetter: INVOICE_DLQ };
  expect(boss.createQueue).toHaveBeenCalledWith(INVOICE_QUEUE, policy);
  expect(boss.updateQueue).toHaveBeenCalledWith(INVOICE_QUEUE, policy);
});

// Excepción manual M1; el reconciliador conserva el comportamiento sin rescatarDlq.
describe('rescate DLQ explícito del comprobante', () => {
  function escenario() {
    const { service, boss } = crearServicio();
    const principal: any[] = []; let dlq: any[] = [{ id: 'dlq', data: { invoice_id: 'i', company_id: 'c' } }];
    boss.findJobs.mockImplementation(async name => name === INVOICE_QUEUE ? [...principal] : [...dlq]);
    boss.send.mockImplementation(async (_name, data) => { if (principal.length) return null; principal.push({ id: 'nuevo', data }); return 'nuevo'; });
    boss.deleteJob.mockImplementation(async (_name, ids) => { dlq = dlq.filter(j => !ids.includes(j.id)); });
    const permitido = jest.fn(async () => true);
    const run = () => service.reenqueueInvoiceIfIdle('i', 'c', permitido, { rescatarDlq: true });
    return { service, boss, principal, dlq: () => dlq, permitido, run };
  }
  it('publica en principal, elimina DLQ y un segundo clic no duplica', async () => {
    const h = escenario(); expect(await h.run()).toEqual({ estado: 'ENCOLADO', jobId: 'nuevo' });
    expect(h.principal).toHaveLength(1); expect(h.dlq()).toHaveLength(0);
    expect(h.permitido.mock.invocationCallOrder[0]).toBeLessThan(h.boss.send.mock.invocationCallOrder[0]);
    expect(await h.run()).toEqual({ estado: 'YA_EN_COLA' }); expect(h.boss.send).toHaveBeenCalledTimes(1);
  });
  it('ni estado no permitido ni empresa ajena permiten publicar/borrar', async () => {
    const h = escenario(); h.permitido.mockResolvedValue(false);
    expect(await h.run()).toEqual({ estado: 'ESTADO_NO_PERMITIDO' });
    expect(h.boss.send).not.toHaveBeenCalled(); expect(h.boss.deleteJob).not.toHaveBeenCalled();
    expect(await h.service.reenqueueInvoiceIfIdle('i', 'otra', undefined, { rescatarDlq: true })).toEqual({ estado: 'EN_DLQ' });
    expect(h.boss.send).not.toHaveBeenCalled();
  });
  it('fallo de publicación conserva DLQ, y fallo de limpieza se recupera sin volver a publicar', async () => {
    const h = escenario(); h.boss.send.mockRejectedValueOnce(new Error('cola caída'));
    await expect(h.run()).rejects.toThrow('cola caída'); expect(h.dlq()).toHaveLength(1);
    h.boss.deleteJob.mockRejectedValueOnce(new Error('limpieza fallida'));
    await expect(h.run()).rejects.toThrow('limpieza fallida'); expect(h.principal).toHaveLength(1); expect(h.dlq()).toHaveLength(1);
    expect(await h.run()).toEqual({ estado: 'YA_EN_COLA' }); expect(h.dlq()).toHaveLength(0); expect(h.boss.send).toHaveBeenCalledTimes(2);
  });
  it('sin publicación comprobada no borra el único trabajo durable', async () => {
    const h = escenario(); h.boss.send.mockResolvedValue(null);
    expect(await h.run()).toEqual({ estado: 'EN_DLQ' }); expect(h.dlq()).toHaveLength(1); expect(h.boss.deleteJob).not.toHaveBeenCalled();
  });
  it('dos rescates concurrentes no publican dos trabajos', async () => {
    const h = escenario(); await Promise.all([h.run(), h.run()]); expect(h.principal).toHaveLength(1); expect(h.dlq()).toHaveLength(0);
  });
});
it('no rescata DLQ sin la compuerta explícita del llamador M1', async () => {
  const { service, boss } = crearServicio();
  boss.findJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'dlq', data: { invoice_id: 'i', company_id: 'c' } }]);
  await expect(service.reenqueueInvoiceIfIdle('i', 'c', undefined, { rescatarDlq: true })).resolves.toEqual({ estado: 'ESTADO_NO_PERMITIDO' });
  expect(boss.send).not.toHaveBeenCalled(); expect(boss.deleteJob).not.toHaveBeenCalled();
});
