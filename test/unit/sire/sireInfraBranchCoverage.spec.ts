import { Logger } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { ConfigService } from '@nestjs/config';
import type {
  QueueService,
  SireImportJobData,
} from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import {
  SireImportJobConsumer,
  SIRE_SIMULACION_DELAY_MS,
} from '../../../src/modules/sire/infrastructure/queue/sireImportJobConsumer';
import type { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
import {
  crearAlmacenamientoLocal,
  crearSireFileStorage,
  ResilientSireFileStorage,
} from '../../../src/modules/sire/infrastructure/storage/sireFileStorageSelector';
import { LocalSireFileStorage } from '../../../src/modules/sire/infrastructure/storage/localSireFileStorage';
import { sanitizarNombreArchivo } from '../../../src/modules/sire/infrastructure/storage/supabaseSireFileStorage';
import { SireReadOnlyPeriodsClient } from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';
import { MockSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/mockSireSunatGateway';
import { UnsupportedSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/unsupportedSireSunatGateway';
import {
  SIRE_FILE_STORAGE_PORT,
  type SireFileStoragePort,
} from '../../../src/modules/sire/domain/ports/sireFileStoragePort';
import { SIRE_SUNAT_GATEWAY } from '../../../src/modules/sire/domain/ports/sireSunatGatewayPort';
import { SireModule } from '../../../src/modules/sire/sireModule';

interface QueueDouble {
  registerSireImportWorker: jest.Mock;
  registerSireImportDlqWorker?: jest.Mock;
}

const jobImportacion: SireImportJobData = {
  messageId: 'message-id',
  companyId: 'company-id',
  tipo: 'IMPORTACION',
  registroId: 'importacion-id',
  periodo: '202401',
  libro: 'RCE_COMPRAS',
};

const jobReporte: SireImportJobData = {
  messageId: 'message-id',
  companyId: 'company-id',
  tipo: 'REPORTE',
  registroId: 'reporte-id',
  periodo: '202401',
  libro: 'RCE_COMPRAS',
};

function crearRepository(): SireMenuRepository {
  return {
    marcarImportacionEnProceso: jest.fn().mockResolvedValue(undefined),
    completarImportacion: jest.fn().mockResolvedValue(undefined),
    fallarImportacion: jest.fn().mockResolvedValue(undefined),
    marcarReporteEnProceso: jest.fn().mockResolvedValue(undefined),
    completarReporte: jest.fn().mockResolvedValue(undefined),
    fallarReporte: jest.fn().mockResolvedValue(undefined),
    buscarImportacionPorMessageId: jest.fn().mockResolvedValue({
      id: 'importacion-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
      nombre_archivo: 'LE20601030013-RCE-202401.txt',
      ruta_archivo: 'ruta/archivo.txt',
      backend_almacen: 'LOCAL',
    }),
    buscarReportePorMessageId: jest.fn().mockResolvedValue({
      ticket: '12345678',
    }),
  } as unknown as SireMenuRepository;
}

function crearStorage(): SireFileStoragePort {
  return {
    leer: jest
      .fn()
      .mockResolvedValue(
        Buffer.from(
          '20601030013|F001|1|100|18|118\n20601030013|F001|2|50|9|59',
        ),
      ),
  } as unknown as SireFileStoragePort;
}

function crearQueue(conDeadLetterQueue: boolean): QueueDouble {
  const queue: QueueDouble = {
    registerSireImportWorker: jest.fn().mockResolvedValue('worker-id'),
  };

  if (conDeadLetterQueue) {
    queue.registerSireImportDlqWorker = jest.fn().mockResolvedValue('dlq-id');
  }

  return queue;
}

function crearConsumidor(
  queue: QueueDouble,
  repository: SireMenuRepository,
): SireImportJobConsumer {
  return new SireImportJobConsumer(
    queue as unknown as QueueService,
    repository,
    crearStorage(),
  );
}

describe('SireImportJobConsumer branch coverage', () => {
  const delayOriginal = process.env['SIRE_SIMULACION_DELAY_MS'];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['SIRE_SIMULACION_DELAY_MS'] = '0';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (delayOriginal === undefined) {
      delete process.env['SIRE_SIMULACION_DELAY_MS'];
    } else {
      process.env['SIRE_SIMULACION_DELAY_MS'] = delayOriginal;
    }
  });

  it('registers only the import worker when the queue has no dead letter queue worker', async () => {
    const queue = crearQueue(false);

    await crearConsumidor(queue, crearRepository()).onModuleInit();

    expect(queue.registerSireImportWorker).toHaveBeenCalled();
    expect(queue.registerSireImportDlqWorker).toBeUndefined();
  });

  it('processes the job that the import worker receives', async () => {
    const queue = crearQueue(true);
    const repository = crearRepository();

    await crearConsumidor(queue, repository).onModuleInit();

    const handler = queue.registerSireImportWorker.mock.calls[0]?.[0] as (
      job: SireImportJobData,
    ) => Promise<void>;

    await handler(jobImportacion);

    expect(repository.marcarImportacionEnProceso).toHaveBeenCalledWith(
      'importacion-id',
    );
    expect(repository.completarImportacion).toHaveBeenCalledWith(
      'importacion-id',
      expect.any(Number),
    );
  });

  it('marks an import as failed when the job reaches the dead letter queue', async () => {
    const queue = crearQueue(true);
    const repository = crearRepository();

    await crearConsumidor(queue, repository).onModuleInit();

    const handler = queue.registerSireImportDlqWorker?.mock.calls[0]?.[0] as (
      job: SireImportJobData,
    ) => Promise<void>;

    await handler(jobImportacion);

    expect(repository.fallarImportacion).toHaveBeenCalledWith(
      'importacion-id',
      'SIRE_RETRIES_EXHAUSTED',
    );
  });

  it('marks a report as failed when the job reaches the dead letter queue', async () => {
    const queue = crearQueue(true);
    const repository = crearRepository();

    await crearConsumidor(queue, repository).onModuleInit();

    const handler = queue.registerSireImportDlqWorker?.mock.calls[0]?.[0] as (
      job: SireImportJobData,
    ) => Promise<void>;

    await handler(jobReporte);

    expect(repository.fallarReporte).toHaveBeenCalledWith(
      'reporte-id',
      'SIRE_RETRIES_EXHAUSTED',
    );
  });

  it('logs the failure when the dead letter queue cannot mark the job as failed', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const queue = crearQueue(true);
    const repository = crearRepository();
    (repository.fallarImportacion as jest.Mock).mockRejectedValue(
      new Error('base de datos caida'),
    );

    await crearConsumidor(queue, repository).onModuleInit();

    const handler = queue.registerSireImportDlqWorker?.mock.calls[0]?.[0] as (
      job: SireImportJobData,
    ) => Promise<void>;

    await expect(handler(jobImportacion)).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo marcar el trabajo SIRE'),
    );
  });

  it('generates a ticket when the report has no stored ticket', async () => {
    const repository = crearRepository();
    (repository.buscarReportePorMessageId as jest.Mock).mockResolvedValue(null);

    await crearConsumidor(crearQueue(true), repository).process(jobReporte);

    expect(repository.completarReporte).toHaveBeenCalledWith(
      'reporte-id',
      expect.stringMatching(/^\d{8}$/),
    );
  });

  it('uses the default simulation delay for reports when the configured delay is not a number', async () => {
    process.env['SIRE_SIMULACION_DELAY_MS'] = 'no-es-un-numero';
    const esperarSpy = jest
      .spyOn(
        SireImportJobConsumer.prototype as unknown as {
          esperar(ms: number): Promise<void>;
        },
        'esperar',
      )
      .mockResolvedValue(undefined);
    const repository = crearRepository();

    await crearConsumidor(crearQueue(true), repository).process(jobReporte);

    expect(esperarSpy).toHaveBeenCalledWith(SIRE_SIMULACION_DELAY_MS);
    expect(repository.completarReporte).toHaveBeenCalled();
  });
});

describe('SireFileStorageSelector branch coverage', () => {
  it('reads the environment of the process when no environment is given', () => {
    const storage = crearSireFileStorage();

    expect(storage).toBeInstanceOf(ResilientSireFileStorage);
  });

  it('builds the local storage from the environment of the process when no environment is given', () => {
    const storage = crearAlmacenamientoLocal();

    expect(storage).toBeInstanceOf(LocalSireFileStorage);
  });
});

describe('SupabaseSireFileStorage branch coverage', () => {
  it('falls back to a generic file name when the name is empty', () => {
    expect(sanitizarNombreArchivo('')).toBe('archivo');
  });
});

describe('SireReadOnlyPeriodsClient branch coverage', () => {
  const config = {
    SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
    SIRE_AUTH_HOST: 'https://api-seguridad.sunat.gob.pe',
    SIRE_API_HOST: 'https://api-sire.sunat.gob.pe',
    SUNAT_CLIENT_ID: 'fake-client-id',
    SUNAT_CLIENT_SECRET: 'fake-client-secret',
    SUNAT_SIRE_READONLY_TIMEOUT_MS: '10000',
  };

  function createClient(
    values: Record<string, string | boolean | undefined>,
    fetcher: typeof fetch,
  ): SireReadOnlyPeriodsClient {
    const configService = {
      get: (name: string) => values[name],
    } as unknown as ConfigService;
    return new SireReadOnlyPeriodsClient(configService, fetcher);
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('uses the credentials of the company instead of the ones of the environment', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fake-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ periodos: ['202601'] }));
    const client = createClient(config, fetcher);

    await expect(
      client.getPeriods(
        '20100070970',
        'FAKEUSER',
        'fake-sol-password',
        '140000',
        {
          clientId: 'company-client-id',
          clientSecret: 'company-client-secret',
        },
      ),
    ).resolves.toEqual({ periodos: ['202601'] });

    const [tokenUrl, tokenRequest] = fetcher.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(tokenUrl.pathname).toBe(
      '/v1/clientessol/company-client-id/oauth2/token/',
    );
    const tokenBody = new URLSearchParams(tokenRequest.body as URLSearchParams);
    expect(tokenBody.get('client_id')).toBe('company-client-id');
    expect(tokenBody.get('client_secret')).toBe('company-client-secret');
  });
});

describe('SireModule provider factories', () => {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    SireModule,
  ) as unknown[];

  function buscarProveedor(
    token: symbol,
  ): { useFactory: (...args: unknown[]) => unknown } {
    const proveedor = providers.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'provide' in item &&
        (item as { provide: unknown }).provide === token,
    ) as { useFactory: (...args: unknown[]) => unknown } | undefined;

    if (!proveedor) {
      throw new Error('El proveedor no está registrado en el módulo SIRE.');
    }

    return proveedor;
  }

  it('builds the file storage from the environment of the process', () => {
    const binding = buscarProveedor(SIRE_FILE_STORAGE_PORT);

    expect(binding.useFactory()).toBeInstanceOf(ResilientSireFileStorage);
  });

  it('selects the mock SUNAT gateway when the environment asks for it', () => {
    const binding = buscarProveedor(SIRE_SUNAT_GATEWAY);
    const mockGateway = new MockSireSunatGateway();
    const unsupportedGateway = new UnsupportedSireSunatGateway();
    const original = process.env['SUNAT_SIRE_ENV'];
    process.env['SUNAT_SIRE_ENV'] = 'mock';

    try {
      expect(binding.useFactory(mockGateway, unsupportedGateway)).toBe(
        mockGateway,
      );
    } finally {
      if (original === undefined) {
        delete process.env['SUNAT_SIRE_ENV'];
      } else {
        process.env['SUNAT_SIRE_ENV'] = original;
      }
    }
  });

  it('selects the unsupported SUNAT gateway when the environment does not ask for the mock', () => {
    const binding = buscarProveedor(SIRE_SUNAT_GATEWAY);
    const mockGateway = new MockSireSunatGateway();
    const unsupportedGateway = new UnsupportedSireSunatGateway();
    const original = process.env['SUNAT_SIRE_ENV'];
    delete process.env['SUNAT_SIRE_ENV'];

    try {
      expect(binding.useFactory(mockGateway, unsupportedGateway)).toBe(
        unsupportedGateway,
      );
    } finally {
      if (original === undefined) {
        delete process.env['SUNAT_SIRE_ENV'];
      } else {
        process.env['SUNAT_SIRE_ENV'] = original;
      }
    }
  });
});
