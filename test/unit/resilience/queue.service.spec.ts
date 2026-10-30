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

    const id = await service.sendToDlq('inv-1', {
      intento: 4,
      codigo_error: 'MAX_REINTENTOS',
    });

    expect(boss.send).toHaveBeenCalledWith(
      INVOICE_DLQ,
      {
        invoice_id: 'inv-1',
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

    await service.sendToDlq('inv-2');

    expect(boss.send).toHaveBeenCalledWith(
      INVOICE_DLQ,
      { invoice_id: 'inv-2' },
      { retryLimit: 0 },
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
          intento: 4,
          codigo_error: 'MAX_REINTENTOS',
          mensaje_error: 'Reintentos agotados',
          estado: 'ERROR_RED',
        },
      },
      {
        id: 'dlq-2',
        retryCount: 2,
        data: {},
      },
    ]);

    const items = await service.listDlq();

    expect(boss.findJobs).toHaveBeenCalledWith(INVOICE_DLQ);
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

  it('devuelve una lista vacía si pg-boss falla al listar la DLQ', async () => {
    const { service, boss } = crearServicio();
    boss.findJobs.mockRejectedValue(new Error('sin conexión'));

    await expect(service.listDlq()).resolves.toEqual([]);
  });

  it('cuenta los jobs en cola y devuelve 0 si pg-boss falla', async () => {
    const { service, boss } = crearServicio();

    boss.findJobs.mockResolvedValueOnce([{}, {}, {}]);
    await expect(service.countQueued()).resolves.toBe(3);

    boss.findJobs.mockRejectedValueOnce(new Error('sin conexión'));
    await expect(service.countQueued()).resolves.toBe(0);
  });

  it('devuelve un job de la DLQ a la cola de reintento', async () => {
    const { service, boss } = crearServicio();

    await service.retryDlq('dlq-1');

    expect(boss.retry).toHaveBeenCalledWith(INVOICE_DLQ, 'dlq-1');
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