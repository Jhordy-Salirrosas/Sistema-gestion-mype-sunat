import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { USER_REPOSITORY_PORT } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SIRE_FILE_STORAGE_PORT } from '../../../src/modules/sire/domain/ports/sireFileStoragePort';
import { SireMenuController } from '../../../src/modules/sire/infrastructure/controllers/sireMenuController';
import { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
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

/**
 * Flujo HTTP del menú SIRE.
 *
 * Se prueba a nivel HTTP (estado, cuerpo y códigos) porque es lo que ve el
 * navegador. Los adaptadores de persistencia, de cola y de almacenamiento
 * están simulados: lo que se verifica aquí es el CONTRATO de los cinco
 * endpoints del menú.
 */
describe('SIRE · menú (flujo HTTP)', () => {
  const RUC = '20601030013';
  const PERIODO = '202401';

  let app: INestApplication;
  const enqueueSireImport = jest.fn();
  const guardarArchivo = jest.fn();
  const historial: Array<{
    id: string;
    fecha: Date;
    tipoAccion: string;
    periodo: string;
    estado: string;
    detalle: string | null;
  }> = [];

  const importaciones = new Map<
    string,
    {
      id: string;
      periodo: string;
      libro: string;
      nombre_archivo: string;
      estado: string;
      message_id: string | null;
      ruta_archivo: string | null;
      hash_archivo: string | null;
      backend_almacen: string | null;
      total_registros: number;
      error_code: string | null;
      created_at: Date;
      completed_at: Date | null;
    }
  >();

  const reportes = new Map<
    string,
    {
      id: string;
      periodo: string;
      libro: string;
      estado: string;
      message_id: string | null;
      ticket: string | null;
      error_code: string | null;
      created_at: Date;
      completed_at: Date | null;
    }
  >();

  const repository = {
    crearImportacion: jest.fn(async (params: Record<string, unknown>) => {
      const id = `importacion-${importaciones.size + 1}`;
      importaciones.set(params['messageId'] as string, {
        id,
        periodo: params['periodo'] as string,
        libro: params['libro'] as string,
        nombre_archivo: params['nombreArchivo'] as string,
        estado: 'PENDING',
        message_id: params['messageId'] as string,
        ruta_archivo: params['rutaArchivo'] as string,
        hash_archivo: params['hashArchivo'] as string,
        backend_almacen: params['backendAlmacen'] as string,
        total_registros: 0,
        error_code: null,
        created_at: new Date(),
        completed_at: null,
      });
      return { id, created_at: new Date() };
    }),
    buscarImportacionPorMessageId: jest.fn(async (messageId: string) =>
      importaciones.get(messageId) ?? null,
    ),
    fallarImportacion: jest.fn(),
    listarImportaciones: jest.fn(async () => [...importaciones.values()]),
    contarImportaciones: jest.fn(async () => importaciones.size),
    crearConciliacion: jest.fn(async () => ({
      id: 'conciliacion-1',
      created_at: new Date(),
    })),
    contarConciliaciones: jest.fn(async () => 1),
    crearReporte: jest.fn(async (params: Record<string, unknown>) => {
      const id = `reporte-${reportes.size + 1}`;
      reportes.set(params['messageId'] as string, {
        id,
        periodo: params['periodo'] as string,
        libro: params['libro'] as string,
        estado: 'PENDING',
        message_id: params['messageId'] as string,
        ticket: params['ticket'] as string,
        error_code: null,
        created_at: new Date(),
        completed_at: null,
      });
      return { id, created_at: new Date() };
    }),
    buscarReportePorMessageId: jest.fn(async (messageId: string) =>
      reportes.get(messageId) ?? null,
    ),
    fallarReporte: jest.fn(),
    contarReportes: jest.fn(async () => reportes.size),
    obtenerHistorial: jest.fn(async () => historial),
  } as unknown as SireMenuRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SireMenuController],
      providers: [
        AuthGuard,
        {
          provide: TOKEN_SERVICE_PORT,
          useValue: {
            verifyToken: jest.fn().mockReturnValue({
              sub: 'user',
              email: 'test@example.test',
              companyId: 'company-a',
              role: 'ADMIN',
            }),
          },
        },
        {
          provide: USER_REPOSITORY_PORT,
          useValue: {
            findCompanyById: jest.fn().mockResolvedValue({
              id: 'company-a',
              ruc: RUC,
              isActive: true,
            }),
          },
        },
        { provide: QueueService, useValue: { enqueueSireImport } },
        {
          provide: SIRE_FILE_STORAGE_PORT,
          useValue: {
            guardar: guardarArchivo.mockResolvedValue({
              ruta: 'sire/company-a/202401/archivo.zip',
              hash: 'hash',
              backend: 'SUPABASE',
              bytes: 10,
            }),
          },
        },
        { provide: SireMenuRepository, useValue: repository },
        ImportarPropuestaSireUseCase,
        ConciliarPeriodoSireUseCase,
        ConsultarImportacionSireUseCase,
        ObtenerResumenSireUseCase,
        ReportarSireUseCase,
        ConsultarReporteSireUseCase,
        ObtenerHistorialSireUseCase,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const autorizar = (peticion: request.Test) =>
    peticion.set('Authorization', 'Bearer token-ficticio');

  it('importa la propuesta y devuelve el messageId para el sondeo', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer())
        .post('/api/v1/sire/importar')
        .attach('file', Buffer.from('contenido'), {
          filename: `LE${RUC}-RCE-${PERIODO}.zip`,
          contentType: 'application/octet-stream',
        }),
    );

    expect(respuesta.status).toBe(202);
    expect(respuesta.body).toMatchObject({
      messageId: expect.any(String),
      estado: 'PENDING',
      periodo: PERIODO,
      libro: 'RCE_COMPRAS',
    });
    expect(enqueueSireImport).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'IMPORTACION', companyId: 'company-a' }),
    );
  });

  it('rechaza un archivo que no es de la empresa', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer())
        .post('/api/v1/sire/importar')
        .attach('file', Buffer.from('contenido'), {
          filename: 'LE11111111111-RCE-202401.zip',
          contentType: 'application/octet-stream',
        }),
    );

    expect(respuesta.status).toBe(400);
    expect(enqueueSireImport).not.toHaveBeenCalled();
  });

  it('rechaza una extensión que no es .txt ni .zip', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer())
        .post('/api/v1/sire/importar')
        .attach('file', Buffer.from('contenido'), {
          filename: `LE${RUC}-RCE-${PERIODO}.pdf`,
          contentType: 'application/pdf',
        }),
    );

    expect(respuesta.status).toBe(400);
  });

  it('devuelve la conciliación del periodo con su resumen y sus comprobantes', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer()).get(
        `/api/v1/sire/conciliacion?periodo=${PERIODO}&libro=RCE_COMPRAS`,
      ),
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resumen.totalComprobantes).toBeGreaterThan(0);
    expect(respuesta.body.comprobantes.length).toBeGreaterThan(0);
    expect(respuesta.body.conciliacionId).toEqual(expect.any(String));
  });

  it('devuelve el resumen del periodo', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer()).get(
        `/api/v1/sire/resumen?periodo=${PERIODO}&libro=RCE_COMPRAS`,
      ),
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.periodo).toBe(PERIODO);
    expect(respuesta.body.resumen).toEqual(
      expect.objectContaining({ totalComprobantes: expect.any(Number) }),
    );
  });

  it('reporta a SUNAT y devuelve el ticket con el messageId', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer())
        .post('/api/v1/sire/reportar')
        .send({ periodo: PERIODO, libro: 'RCE_COMPRAS' }),
    );

    expect(respuesta.status).toBe(202);
    expect(respuesta.body.ticket).toMatch(/^\d{8}$/);
    expect(respuesta.body.messageId).toEqual(expect.any(String));
    expect(enqueueSireImport).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'REPORTE' }),
    );
  });

  it('devuelve el historial unificado con fecha, tipo, periodo y estado', async () => {
    historial.push(
      {
        id: 'importacion-1',
        fecha: new Date('2026-01-05T10:00:00.000Z'),
        tipoAccion: 'IMPORTACION',
        periodo: PERIODO,
        estado: 'COMPLETED',
        detalle: 'archivo.zip',
      },
      {
        id: 'reporte-1',
        fecha: new Date('2026-01-04T10:00:00.000Z'),
        tipoAccion: 'REPORTE',
        periodo: PERIODO,
        estado: 'COMPLETED',
        detalle: '12345678',
      },
    );

    const respuesta = await autorizar(
      request(app.getHttpServer()).get(`/api/v1/sire/historial`),
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBe(2);
    expect(respuesta.body.filas[0]).toEqual(
      expect.objectContaining({
        fecha: expect.any(String),
        tipoAccion: expect.any(String),
        periodo: expect.any(String),
        estado: expect.any(String),
      }),
    );
  });

  it('exige un periodo con formato AAAAMM', async () => {
    const respuesta = await autorizar(
      request(app.getHttpServer()).get('/api/v1/sire/conciliacion?periodo=2024'),
    );

    expect(respuesta.status).toBe(400);
  });

  it('exige autenticación en todos los flujos del menú', async () => {
    const rutas: Array<[string, string]> = [
      ['get', '/api/v1/sire/conciliacion?periodo=202401'],
      ['get', '/api/v1/sire/resumen?periodo=202401'],
      ['get', '/api/v1/sire/historial'],
      ['post', '/api/v1/sire/reportar'],
    ];

    for (const [metodo, ruta] of rutas) {
      const peticion = request(app.getHttpServer())[metodo as 'get' | 'post'](
        ruta,
      );
      const respuesta = await peticion.send({ periodo: PERIODO, libro: 'RCE_COMPRAS' });
      expect(respuesta.status).toBe(401);
    }
  });
});
