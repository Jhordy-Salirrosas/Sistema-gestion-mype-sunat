import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { USER_REPOSITORY_PORT } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { ConsultarImportacionSireUseCase } from '../../../src/modules/sire/application/use-cases/conciliarPeriodoSireUseCase';
import { ConsultarReporteSireUseCase } from '../../../src/modules/sire/application/use-cases/reportarSireUseCase';
import { SimulateManualSireConsultationUseCase } from '../../../src/modules/sire/application/use-cases/simulateManualSireConsultationUseCase';
import { ImportarPropuestaSireUseCase } from '../../../src/modules/sire/application/use-cases/importarPropuestaSireUseCase';
import { ConciliarPeriodoSireUseCase } from '../../../src/modules/sire/application/use-cases/conciliarPeriodoSireUseCase';
import { ObtenerResumenSireUseCase } from '../../../src/modules/sire/application/use-cases/obtenerResumenSireUseCase';
import { ReportarSireUseCase } from '../../../src/modules/sire/application/use-cases/reportarSireUseCase';
import { ObtenerHistorialSireUseCase } from '../../../src/modules/sire/application/use-cases/obtenerHistorialSireUseCase';
import { SIRE_FILE_STORAGE_PORT } from '../../../src/modules/sire/domain/ports/sireFileStoragePort';
import { ManualSireConsultationController } from '../../../src/modules/sire/infrastructure/controllers/manualSireConsultationController';
import { SireMenuController } from '../../../src/modules/sire/infrastructure/controllers/sireMenuController';
import { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

/**
 * Auditoría de seguridad del módulo SIRE a nivel HTTP.
 *
 * Comprueba lo que el navegador ve:
 *
 * - el `companyId` se toma del token y no del cuerpo;
 * - un RUC ajeno se rechaza con `403` y no ejecuta la simulación;
 * - un trabajo fallido se informa con `200` y un `message` legible, nunca con
 *   un `500` ni con un error interno.
 */
describe('SIRE · auditoría de seguridad (flujo HTTP)', () => {
  const RUC = '20601030013';
  const RUC_AJENO = '11111111111';

  let app: INestApplication;
  const simular = jest.fn().mockReturnValue({ mode: 'SIMULATED' });

  const importacionFallida = {
    id: 'importacion-1',
    periodo: '202401',
    libro: 'RCE_COMPRAS',
    nombre_archivo: 'LE20601030013-RCE-202401.zip',
    estado: 'FAILED',
    message_id: '7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70',
    ruta_archivo: 'ruta',
    hash_archivo: 'hash',
    backend_almacen: 'SUPABASE',
    total_registros: 0,
    error_code: 'SIRE_RETRIES_EXHAUSTED',
    created_at: new Date('2026-11-15T12:00:00.000Z'),
    completed_at: null,
  };

  const reporteFallido = {
    id: 'reporte-1',
    periodo: '202401',
    libro: 'RCE_COMPRAS',
    estado: 'FAILED',
    message_id: 'c1a2b3d4-1111-4222-8333-444455556666',
    ticket: null,
    error_code: 'QUEUE_ENQUEUE_FAILED',
    created_at: new Date('2026-11-15T12:10:00.000Z'),
    completed_at: null,
  };

  const repository = {
    buscarImportacionPorMessageId: jest.fn(async () => importacionFallida),
    buscarReportePorMessageId: jest.fn(async () => reporteFallido),
  } as unknown as SireMenuRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SireMenuController, ManualSireConsultationController],
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
        {
          provide: SimulateManualSireConsultationUseCase,
          useValue: { execute: simular },
        },
        { provide: QueueService, useValue: { enqueueSireImport: jest.fn() } },
        {
          provide: SIRE_FILE_STORAGE_PORT,
          useValue: {
            guardar: jest.fn().mockResolvedValue({
              ruta: 'ruta',
              hash: 'hash',
              backend: 'SUPABASE',
              bytes: 1,
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

  describe('POST /api/v1/sire/consulta-manual', () => {
    it('rechaza con 403 un RUC que no es el de la empresa de la sesión', async () => {
      const respuesta = await autorizar(
        request(app.getHttpServer()).post('/api/v1/sire/consulta-manual').send({
          ruc: RUC_AJENO,
          period: '202401',
          solPassword: 'clave-ficticia',
        }),
      );

      expect(respuesta.status).toBe(403);
      expect(simular).not.toHaveBeenCalled();
    });

    it('consulta con el RUC de la empresa de la sesión', async () => {
      const respuesta = await autorizar(
        request(app.getHttpServer()).post('/api/v1/sire/consulta-manual').send({
          ruc: RUC,
          period: '202401',
          solPassword: 'clave-ficticia',
        }),
      );

      expect(respuesta.status).toBe(200);
      expect(simular).toHaveBeenCalledWith({ ruc: RUC, period: '202401' });
    });
  });

  describe('estado de un trabajo fallido', () => {
    it('responde 200 con un mensaje legible en la importación', async () => {
      const respuesta = await autorizar(
        request(app.getHttpServer()).get(
          '/api/v1/sire/importar/estado/7d9f1b23-4e5a-4c8d-9f10-2b3c4d5e6f70',
        ),
      );

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('FAILED');
      expect(respuesta.body.errorCode).toBe('SIRE_RETRIES_EXHAUSTED');
      expect(respuesta.body.message).toEqual(expect.any(String));
      expect(respuesta.body.message.length).toBeGreaterThan(0);
    });

    it('responde 200 con un mensaje legible en el reporte', async () => {
      const respuesta = await autorizar(
        request(app.getHttpServer()).get(
          '/api/v1/sire/reportar/estado/c1a2b3d4-1111-4222-8333-444455556666',
        ),
      );

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('FAILED');
      expect(respuesta.body.errorCode).toBe('QUEUE_ENQUEUE_FAILED');
      expect(respuesta.body.message).toEqual(expect.any(String));
      expect(respuesta.body.message.length).toBeGreaterThan(0);
    });
  });
});
