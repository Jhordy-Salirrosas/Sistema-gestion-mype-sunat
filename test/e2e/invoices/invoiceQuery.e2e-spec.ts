/**
 * TA-29 — prueba e2e de listado, detalle y reintento (criterio 6).
 *
 * Levanta la aplicación Nest REAL (AppModule) con el cliente Prisma
 * reemplazado por un doble en memoria. Así se ejercita el camino completo que
 * recorre una petición: guard de autenticación, decorador de empresa,
 * controlador, servicio, filtros y serialización.
 *
 * Lo que se verifica aquí y no se puede verificar en una prueba unitaria:
 *   - que la empresa sale del JWT y no de la query (criterio 4);
 *   - que un recurso de otra empresa responde 404 y no 403;
 *   - que el JSON devuelto tiene la forma que consume el frontend.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../src/appModule';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { InvoiceStatus } from '../../../src/generated/client/enums';

describe('Consulta de comprobantes (e2e) - TA-29', () => {
  let app: INestApplication<App>;
  let tokenPropio: string;
  let tokenAjeno: string;

  const EMPRESA = 'company-e2e-001';
  const OTRA_EMPRESA = 'company-e2e-002';

  /** Fila completa tal como la devolvería Prisma con SELECT_DETALLE. */
  const FILA = {
    id: 'inv-e2e-1',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 7,
    fecha_emision: new Date('2026-10-30T15:00:00Z'),
    estado: InvoiceStatus.ACEPTADO,
    monto_total: { toString: () => '118.00' },
    currency_code: 'PEN',
    customer_identity_number: '20100070970',
    customer_legal_name: 'CLIENTE SAC',
    sunat_response_code: '0',
    ruc_emisor: '20601012341',
    taxable_operations: { toString: () => '100.00' },
    total_igv: { toString: () => '18.00' },
    cdr_sunat: { responseCode: '0', description: 'Aceptado' },
    created_at: new Date('2026-10-30T10:00:00Z'),
    updated_at: new Date('2026-10-30T10:00:05Z'),
    history: [
      {
        id: 'h-1',
        intento: 1,
        estado_anterior: InvoiceStatus.PROCESANDO,
        estado_nuevo: InvoiceStatus.ACEPTADO,
        codigo_error: '0',
        mensaje_error: 'Aceptado',
        tiempo_respuesta_ms: 812,
        created_at: new Date('2026-10-30T10:00:05Z'),
      },
    ],
  };

  /** Doble de Prisma: la fila solo existe para EMPRESA. */
  const prismaDoble = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    ),
    invoice: {
      findMany: jest.fn().mockResolvedValue([FILA]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn(async (args: { where: { company_id: string } }) =>
        args.where.company_id === EMPRESA ? FILA : null,
      ),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  const queueDoble = {
    enqueueInvoiceInTx: jest.fn().mockResolvedValue('job-1'),
  };

  beforeAll(async () => {
    // El token se firma con el MISMO secreto que usará el guard de la app.
    // AppModule carga el .env, así que aquí hay que leer el mismo valor; con
    // un ConfigService vacío el adaptador caería al secreto de desarrollo y
    // el guard rechazaría el token con 401.
    const tokenService = new NativeJwtAdapter({
      get: (clave: string) =>
        clave === 'JWT_SECRET' ? process.env.JWT_SECRET : undefined,
    } as unknown as ConfigService);

    tokenPropio = tokenService.signToken({
      sub: 'user-e2e',
      email: 'e2e@mype.pe',
      companyId: EMPRESA,
      role: 'ADMIN',
    });

    tokenAjeno = tokenService.signToken({
      sub: 'user-otro',
      email: 'otro@mype.pe',
      companyId: OTRA_EMPRESA,
      role: 'ADMIN',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaDoble)
      .overrideProvider(QueueService)
      .useValue(queueDoble)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/invoices', () => {
    it('responde 401 sin token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .expect(401);
    });

    it('devuelve el listado paginado con el contrato del frontend', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/v1/invoices?page=1')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(200);

      expect(respuesta.body).toEqual(
        expect.objectContaining({
          data: expect.any(Array),
          total: 1,
          page: 1,
          total_pages: 1,
        }),
      );

      const fila = respuesta.body.data[0];
      expect(fila).toEqual(
        expect.objectContaining({
          id: 'inv-e2e-1',
          numero: 'F001-00000007',
          estado: 'ACEPTADO',
          monto_total: 118,
        }),
      );
    });

    it('filtra por la empresa del token, nunca por la query', async () => {
      await request(app.getHttpServer())
        // Se intenta forzar otra empresa por query: debe ignorarse.
        .get(`/api/v1/invoices?company_id=${OTRA_EMPRESA}`)
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(200);

      expect(prismaDoble.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ company_id: EMPRESA }),
        }),
      );
    });

    it('aplica los filtros de estado y serie', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices?estado=ACEPTADO&serie=f001&tipo=1')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(200);

      expect(prismaDoble.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: 'ACEPTADO',
            serie: 'F001',
            tipo_comprobante: '01',
          }),
        }),
      );
    });

    it('rechaza un estado inexistente con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices?estado=PAGADO')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(400);
    });

    it('rechaza un rango de fechas invertido con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices?desde=2026-10-30&hasta=2026-10-01')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    it('devuelve el comprobante con su CDR y su historial', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/v1/invoices/inv-e2e-1')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(200);

      expect(respuesta.body).toEqual(
        expect.objectContaining({
          id: 'inv-e2e-1',
          ruc_emisor: '20601012341',
          cdr: expect.objectContaining({ codigo: '0' }),
          historial: expect.arrayContaining([
            expect.objectContaining({ estado_nuevo: 'ACEPTADO' }),
          ]),
        }),
      );
    });

    it('responde 404 (no 403) para un comprobante de otra empresa', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices/inv-e2e-1')
        .set('Authorization', `Bearer ${tokenAjeno}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/invoices/:id/retry-cdr', () => {
    it('reencola y registra la auditoría', async () => {
      prismaDoble.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-e2e-1',
        estado: InvoiceStatus.ERROR_RED,
      } as unknown as Awaited<
        ReturnType<typeof prismaDoble.invoice.findFirst>
      >);

      const respuesta = await request(app.getHttpServer())
        .post('/api/v1/invoices/inv-e2e-1/retry-cdr')
        .set('Authorization', `Bearer ${tokenPropio}`)
        .expect(201);

      expect(respuesta.body).toEqual(
        expect.objectContaining({ encolado: true }),
      );
      expect(queueDoble.enqueueInvoiceInTx).toHaveBeenCalled();
      expect(prismaDoble.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'RETRY_CDR' }),
        }),
      );
    });

    it('responde 404 para un comprobante de otra empresa', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/invoices/inv-e2e-1/retry-cdr')
        .set('Authorization', `Bearer ${tokenAjeno}`)
        .expect(404);
    });
  });
});
