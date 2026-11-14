import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { SireFileStoragePort } from '../../../src/modules/sire/domain/ports/sireFileStoragePort';
import { ImportarPropuestaSireUseCase } from '../../../src/modules/sire/application/use-cases/importarPropuestaSireUseCase';
import {
  ConciliarPeriodoSireUseCase,
  ConsultarImportacionSireUseCase,
} from '../../../src/modules/sire/application/use-cases/conciliarPeriodoSireUseCase';
import { ObtenerResumenSireUseCase } from '../../../src/modules/sire/application/use-cases/obtenerResumenSireUseCase';
import {
  ConsultarReporteSireUseCase,
  ReportarSireUseCase,
} from '../../../src/modules/sire/application/use-cases/reportarSireUseCase';
import { ObtenerHistorialSireUseCase } from '../../../src/modules/sire/application/use-cases/obtenerHistorialSireUseCase';
import { friendlySireJobFailureMessage } from '../../../src/modules/sire/domain/rules/sireJobFailureMessages';
import type { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

const COMPANY_ID = 'company-id';
const RUC = '20601030013';

function crearRepository() {
  return {
    crearImportacion: jest.fn().mockResolvedValue({
      id: 'importacion-id',
      created_at: new Date('2026-01-05T10:00:00.000Z'),
    }),
    marcarImportacionEnProceso: jest.fn().mockResolvedValue(undefined),
    completarImportacion: jest.fn().mockResolvedValue(undefined),
    fallarImportacion: jest.fn().mockResolvedValue(undefined),
    buscarImportacionPorMessageId: jest.fn(),
    listarImportaciones: jest.fn().mockResolvedValue([]),
    contarImportaciones: jest.fn().mockResolvedValue(0),
    crearConciliacion: jest
      .fn()
      .mockResolvedValue({
        id: 'conciliacion-id',
        created_at: new Date('2026-01-06T10:00:00.000Z'),
      }),
    contarConciliaciones: jest.fn().mockResolvedValue(0),
    crearReporte: jest.fn().mockResolvedValue({
      id: 'reporte-id',
      created_at: new Date('2026-01-07T10:00:00.000Z'),
    }),
    marcarReporteEnProceso: jest.fn().mockResolvedValue(undefined),
    completarReporte: jest.fn().mockResolvedValue(undefined),
    fallarReporte: jest.fn().mockResolvedValue(undefined),
    buscarReportePorMessageId: jest.fn(),
    contarReportes: jest.fn().mockResolvedValue(0),
    obtenerHistorial: jest.fn().mockResolvedValue([]),
  } as unknown as SireMenuRepository;
}

function crearQueue() {
  return {
    enqueueSireImport: jest.fn().mockResolvedValue('job-id'),
  } as unknown as QueueService;
}

function crearStorage(): SireFileStoragePort {
  return {
    guardar: jest.fn().mockResolvedValue({
      ruta: 'sire/company-id/202401/archivo.zip',
      hash: 'hash-del-archivo',
      backend: 'SUPABASE',
      bytes: 128,
    }),
  };
}

function archivo(nombre: string) {
  return {
    originalname: nombre,
    mimetype: 'application/octet-stream',
    buffer: Buffer.from('contenido'),
  };
}

describe('ImportarPropuestaSireUseCase', () => {
  it('stores the file, registers the import and enqueues the job', async () => {
    const repository = crearRepository();
    const queue = crearQueue();
    const storage = crearStorage();
    const useCase = new ImportarPropuestaSireUseCase(
      repository,
      queue,
      storage,
    );

    const resultado = await useCase.execute(
      COMPANY_ID,
      RUC,
      {},
      archivo(`LE${RUC}-RCE-202401.zip`),
    );

    expect(resultado.estado).toBe('PENDING');
    expect(resultado.importacionId).toBe('importacion-id');
    expect(resultado.periodo).toBe('202401');
    expect(resultado.libro).toBe('RCE_COMPRAS');
    expect(resultado.messageId).toEqual(expect.any(String));

    expect(storage.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        periodo: '202401',
        nombreArchivo: `LE${RUC}-RCE-202401.zip`,
      }),
    );

    expect(queue.enqueueSireImport).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        tipo: 'IMPORTACION',
        registroId: 'importacion-id',
        periodo: '202401',
        libro: 'RCE_COMPRAS',
      }),
    );
  });

  it('prefers the period and the book sent in the body', async () => {
    const repository = crearRepository();
    const queue = crearQueue();
    const useCase = new ImportarPropuestaSireUseCase(
      repository,
      queue,
      crearStorage(),
    );

    const resultado = await useCase.execute(
      COMPANY_ID,
      RUC,
      { periodo: '202402', libro: 'RVIE_VENTAS' },
      archivo(`LE${RUC}-RCE-202401.zip`),
    );

    expect(resultado.periodo).toBe('202402');
    expect(resultado.libro).toBe('RVIE_VENTAS');
  });

  it('rejects a file that does not belong to the company', async () => {
    const repository = crearRepository();
    const queue = crearQueue();
    const useCase = new ImportarPropuestaSireUseCase(
      repository,
      queue,
      crearStorage(),
    );

    await expect(
      useCase.execute(
        COMPANY_ID,
        RUC,
        {},
        archivo('LE20123456789-RCE-202401.zip'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queue.enqueueSireImport).not.toHaveBeenCalled();
    expect(repository.crearImportacion).not.toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    const useCase = new ImportarPropuestaSireUseCase(
      crearRepository(),
      crearQueue(),
      crearStorage(),
    );

    await expect(
      useCase.execute(
        COMPANY_ID,
        RUC,
        {},
        undefined as unknown as ReturnType<typeof archivo>,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails the import when the queue is not available', async () => {
    const repository = crearRepository();
    const queue = crearQueue();
    (queue.enqueueSireImport as jest.Mock).mockRejectedValue(
      new Error('PgBoss está en modo bypass.'),
    );
    const useCase = new ImportarPropuestaSireUseCase(
      repository,
      queue,
      crearStorage(),
    );

    await expect(
      useCase.execute(
        COMPANY_ID,
        RUC,
        {},
        archivo(`LE${RUC}-RCE-202401.zip`),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(repository.fallarImportacion).toHaveBeenCalledWith(
      'importacion-id',
      'QUEUE_ENQUEUE_FAILED',
    );
  });
});

describe('ConciliarPeriodoSireUseCase', () => {
  it('reads the imports of the period, returns the mock and stores the result', async () => {
    const repository = crearRepository();
    (repository.listarImportaciones as jest.Mock).mockResolvedValue([
      { id: 'a', periodo: '202401', libro: 'RCE_COMPRAS', nombre_archivo: 'LE1', estado: 'COMPLETED', created_at: new Date() },
      { id: 'b', periodo: '202401', libro: 'RCE_COMPRAS', nombre_archivo: 'LE2', estado: 'COMPLETED', created_at: new Date() },
    ]);

    const resultado = await new ConciliarPeriodoSireUseCase(
      repository,
    ).execute(COMPANY_ID, '202401', 'RCE_COMPRAS');

    expect(repository.listarImportaciones).toHaveBeenCalledWith(
      COMPANY_ID,
      '202401',
      'RCE_COMPRAS',
    );
    expect(resultado.resumen.totalComprobantes).toBe(8);
    expect(resultado.comprobantes).toHaveLength(8);
    expect(repository.crearConciliacion).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        periodo: '202401',
        conciliados: resultado.resumen.conciliados,
        diferencias: resultado.resumen.diferencias,
      }),
    );
  });

  it('returns the state of an import for the polling endpoint', async () => {
    const repository = crearRepository();
    (repository.buscarImportacionPorMessageId as jest.Mock).mockResolvedValue({
      id: 'importacion-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
      nombre_archivo: 'LE1.zip',
      estado: 'COMPLETED',
      message_id: 'message-id',
      ruta_archivo: 'ruta',
      hash_archivo: 'hash',
      backend_almacen: 'SUPABASE',
      total_registros: 10,
      error_code: null,
      created_at: new Date('2026-01-05T10:00:00.000Z'),
      completed_at: new Date('2026-01-05T10:00:05.000Z'),
    });

    const resultado = await new ConsultarImportacionSireUseCase(
      repository,
    ).execute(COMPANY_ID, 'message-id');

    expect(resultado.estado).toBe('COMPLETED');
    expect(resultado.completedAt).toBe('2026-01-05T10:00:05.000Z');
    expect(resultado.message).toBeNull();
  });

  it('explains a failed import with a friendly message instead of a raw code', async () => {
    const repository = crearRepository();
    (repository.buscarImportacionPorMessageId as jest.Mock).mockResolvedValue({
      id: 'importacion-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
      nombre_archivo: 'LE1.zip',
      estado: 'FAILED',
      message_id: 'message-id',
      ruta_archivo: 'ruta',
      hash_archivo: 'hash',
      backend_almacen: 'SUPABASE',
      total_registros: 0,
      error_code: 'SIRE_RETRIES_EXHAUSTED',
      created_at: new Date('2026-01-05T10:00:00.000Z'),
      completed_at: null,
    });

    const resultado = await new ConsultarImportacionSireUseCase(
      repository,
    ).execute(COMPANY_ID, 'message-id');

    expect(resultado.estado).toBe('FAILED');
    expect(resultado.errorCode).toBe('SIRE_RETRIES_EXHAUSTED');
    expect(resultado.message).toBe(
      friendlySireJobFailureMessage('SIRE_RETRIES_EXHAUSTED'),
    );
    expect(resultado.message).toEqual(expect.any(String));
    expect(resultado.message?.length).toBeGreaterThan(0);
  });
});

describe('ObtenerResumenSireUseCase', () => {
  it('returns the simulated totals together with the real counters', async () => {
    const repository = crearRepository();
    (repository.contarImportaciones as jest.Mock).mockResolvedValue(3);
    (repository.contarConciliaciones as jest.Mock).mockResolvedValue(2);
    (repository.contarReportes as jest.Mock).mockResolvedValue(1);

    const resultado = await new ObtenerResumenSireUseCase(repository).execute(
      COMPANY_ID,
      '202401',
      'RVIE_VENTAS',
    );

    expect(resultado.importaciones).toBe(3);
    expect(resultado.conciliaciones).toBe(2);
    expect(resultado.reportes).toBe(1);
    expect(resultado.resumen.totalComprobantes).toBe(12);
  });
});

describe('ReportarSireUseCase', () => {
  it('registers the report, returns the ticket and enqueues the job', async () => {
    const repository = crearRepository();
    const queue = crearQueue();

    const resultado = await new ReportarSireUseCase(
      repository,
      queue,
    ).execute(COMPANY_ID, { periodo: '202401', libro: 'RCE_COMPRAS' });

    expect(resultado.ticket).toMatch(/^\d{8}$/);
    expect(resultado.estado).toBe('PENDING');
    expect(queue.enqueueSireImport).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'REPORTE',
        registroId: 'reporte-id',
        periodo: '202401',
      }),
    );
  });

  it('fails the report when the queue is not available', async () => {
    const repository = crearRepository();
    const queue = crearQueue();
    (queue.enqueueSireImport as jest.Mock).mockRejectedValue(
      new Error('sin cola'),
    );

    await expect(
      new ReportarSireUseCase(repository, queue).execute(COMPANY_ID, {
        periodo: '202401',
        libro: 'RCE_COMPRAS',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(repository.fallarReporte).toHaveBeenCalledWith(
      'reporte-id',
      'QUEUE_ENQUEUE_FAILED',
    );
  });

  it('returns the state of a report for the polling endpoint', async () => {
    const repository = crearRepository();
    (repository.buscarReportePorMessageId as jest.Mock).mockResolvedValue({
      id: 'reporte-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
      estado: 'COMPLETED',
      message_id: 'message-id',
      ticket: '12345678',
      error_code: null,
      created_at: new Date('2026-01-07T10:00:00.000Z'),
      completed_at: new Date('2026-01-07T10:00:03.000Z'),
    });

    const resultado = await new ConsultarReporteSireUseCase(
      repository,
    ).execute(COMPANY_ID, 'message-id');

    expect(resultado.estado).toBe('COMPLETED');
    expect(resultado.ticket).toBe('12345678');
    expect(resultado.message).toBeNull();
  });

  it('explains a failed report with a friendly message instead of a raw code', async () => {
    const repository = crearRepository();
    (repository.buscarReportePorMessageId as jest.Mock).mockResolvedValue({
      id: 'reporte-id',
      periodo: '202401',
      libro: 'RCE_COMPRAS',
      estado: 'FAILED',
      message_id: 'message-id',
      ticket: null,
      error_code: 'QUEUE_ENQUEUE_FAILED',
      created_at: new Date('2026-01-07T10:00:00.000Z'),
      completed_at: null,
    });

    const resultado = await new ConsultarReporteSireUseCase(
      repository,
    ).execute(COMPANY_ID, 'message-id');

    expect(resultado.estado).toBe('FAILED');
    expect(resultado.errorCode).toBe('QUEUE_ENQUEUE_FAILED');
    expect(resultado.message).toBe(
      friendlySireJobFailureMessage('QUEUE_ENQUEUE_FAILED'),
    );
  });
});

describe('ObtenerHistorialSireUseCase', () => {
  it('maps the joined rows into the unified history list', async () => {
    const repository = crearRepository();
    (repository.obtenerHistorial as jest.Mock).mockResolvedValue([
      {
        id: 'importacion-id',
        fecha: new Date('2026-01-05T10:00:00.000Z'),
        tipoAccion: 'IMPORTACION',
        periodo: '202401',
        estado: 'COMPLETED',
        detalle: 'LE20601030013-RCE-202401.zip',
      },
    ]);

    const resultado = await new ObtenerHistorialSireUseCase(
      repository,
    ).execute(COMPANY_ID, null, 50);

    expect(repository.obtenerHistorial).toHaveBeenCalledWith(
      COMPANY_ID,
      null,
      50,
    );
    expect(resultado.total).toBe(1);
    expect(resultado.filas[0]).toEqual({
      id: 'importacion-id',
      fecha: '2026-01-05T10:00:00.000Z',
      tipoAccion: 'IMPORTACION',
      periodo: '202401',
      estado: 'COMPLETED',
      detalle: 'LE20601030013-RCE-202401.zip',
    });
  });

  it('uses the default limit when the request does not ask for one', async () => {
    const repository = crearRepository();

    await new ObtenerHistorialSireUseCase(repository).execute(
      COMPANY_ID,
      '202401',
      null,
    );

    expect(repository.obtenerHistorial).toHaveBeenCalledWith(
      COMPANY_ID,
      '202401',
      100,
    );
  });
});
