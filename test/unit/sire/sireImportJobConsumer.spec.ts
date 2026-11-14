import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import {
  SireImportJobConsumer,
  SIRE_SIMULACION_DELAY_MS,
} from '../../../src/modules/sire/infrastructure/queue/sireImportJobConsumer';
import type { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';

function crearRepository() {
  return {
    marcarImportacionEnProceso: jest.fn().mockResolvedValue(undefined),
    completarImportacion: jest.fn().mockResolvedValue(undefined),
    fallarImportacion: jest.fn().mockResolvedValue(undefined),
    marcarReporteEnProceso: jest.fn().mockResolvedValue(undefined),
    completarReporte: jest.fn().mockResolvedValue(undefined),
    fallarReporte: jest.fn().mockResolvedValue(undefined),
    buscarReportePorMessageId: jest.fn().mockResolvedValue({
      ticket: '12345678',
    }),
  } as unknown as SireMenuRepository;
}

function crearQueue() {
  return {
    registerSireImportWorker: jest.fn().mockResolvedValue('worker-id'),
    registerSireImportDlqWorker: jest.fn().mockResolvedValue('dlq-id'),
  } as unknown as QueueService;
}

describe('SireImportJobConsumer', () => {
  const delayOriginal = process.env['SIRE_SIMULACION_DELAY_MS'];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['SIRE_SIMULACION_DELAY_MS'] = '0';
  });

  afterAll(() => {
    if (delayOriginal === undefined) {
      delete process.env['SIRE_SIMULACION_DELAY_MS'];
    } else {
      process.env['SIRE_SIMULACION_DELAY_MS'] = delayOriginal;
    }
  });

  it('registers the worker and the dead letter queue worker', async () => {
    const queue = crearQueue();

    await new SireImportJobConsumer(queue, crearRepository()).onModuleInit();

    expect(queue.registerSireImportWorker).toHaveBeenCalled();
    expect(queue.registerSireImportDlqWorker).toHaveBeenCalled();
  });

  it('does not break the boot when the queue does not expose the registration', async () => {
    const queue = {
      registerSirePeriodsWorker: jest.fn(),
    } as unknown as QueueService;

    await expect(
      new SireImportJobConsumer(queue, crearRepository()).onModuleInit(),
    ).resolves.toBeUndefined();
  });

  it('marks an import as completed after the simulated processing', async () => {
    const repository = crearRepository();
    const consumer = new SireImportJobConsumer(crearQueue(), repository);

    await consumer.process({
      messageId: 'message-id',
      companyId: 'company-id',
      tipo: 'IMPORTACION',
      registroId: 'importacion-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
    });

    expect(repository.marcarImportacionEnProceso).toHaveBeenCalledWith(
      'importacion-id',
    );
    expect(repository.completarImportacion).toHaveBeenCalledWith(
      'importacion-id',
      expect.any(Number),
    );
  });

  it('marks a report as completed with its ticket', async () => {
    const repository = crearRepository();
    const consumer = new SireImportJobConsumer(crearQueue(), repository);

    await consumer.process({
      messageId: 'message-id',
      companyId: 'company-id',
      tipo: 'REPORTE',
      registroId: 'reporte-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
    });

    expect(repository.marcarReporteEnProceso).toHaveBeenCalledWith(
      'reporte-id',
    );
    expect(repository.completarReporte).toHaveBeenCalledWith(
      'reporte-id',
      '12345678',
    );
  });

  it('rethrows the failure so that PgBoss retries the job', async () => {
    const repository = crearRepository();
    (repository.completarImportacion as jest.Mock).mockRejectedValue(
      new Error('fallo de base de datos'),
    );
    const consumer = new SireImportJobConsumer(crearQueue(), repository);

    await expect(
      consumer.process({
        messageId: 'message-id',
        companyId: 'company-id',
        tipo: 'IMPORTACION',
        registroId: 'importacion-id',
        periodo: '202401',
        libro: 'RCE_COMPRAS',
      }),
    ).rejects.toThrow('fallo de base de datos');
  });

  it('waits two seconds by default to simulate the processing', () => {
    delete process.env['SIRE_SIMULACION_DELAY_MS'];

    expect(SIRE_SIMULACION_DELAY_MS).toBe(2_000);
  });
});
