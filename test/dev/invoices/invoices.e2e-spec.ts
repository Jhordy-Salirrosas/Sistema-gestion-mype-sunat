
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../src/app.module';
import { InvoicesService } from '../../../src/modules/invoices/invoices.service';

describe('InvoicesController (e2e)', () => {
  let app: INestApplication<App>;

  const apiKey = 'super-secret-test-key';

  const mockInvoicesService = {
    create: jest.fn(),
  };

  beforeAll(async () => {
    process.env.API_KEY = apiKey;

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(InvoicesService)
        .useValue(mockInvoicesService)
        .overrideProvider(
          require('../../../src/prisma/prisma.service').PrismaService,
        )
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
          $transaction: jest.fn(),
        })
        .overrideProvider(
          require('../../../src/modules/queue/queue.service').QueueService,
        )
        .useValue({
          enqueueInvoiceInTx: jest.fn(),
        })
        .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const formattedErrors = errors.map((error) => {
            const rule = Object.keys(error.constraints || {})[0];
            const message = error.constraints
              ? error.constraints[rule]
              : 'Dato inválido';

            return {
              field: error.property,
              rule,
              message,
            };
          });

          return new BadRequestException(formattedErrors);
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    ruc_emisor: '20100070970',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    monto_total: 118.5,
    fecha_emision: '2026-10-09T10:00:00.000Z',
    payload_ubl: {
      version: '2.1',
      documento: 'prueba',
    },
  };

  it('rechaza peticiones sin API Key (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .send(validPayload)
      .expect(401);
  });

  it('rechaza comprobantes inválidos con errores estructurados (400)', async () => {
    const invalidPayload = {
      ...validPayload,
      ruc_emisor: '12345678901',
      serie: 'B001',
      correlativo: 999999999,
      monto_total: -100,
      fecha_emision: 'ayer',
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('x-api-key', apiKey)
      .send(invalidPayload)
      .expect(400);

    expect(Array.isArray(response.body.message)).toBe(true);

    const errors = response.body.message;

    for (const error of errors) {
      expect(error).toHaveProperty('field');
      expect(error).toHaveProperty('rule');
      expect(error).toHaveProperty('message');
    }

    const fields = errors.map((error: { field: string }) => error.field);

    expect(fields).toContain('ruc_emisor');
    expect(fields).toContain('serie');
    expect(fields).toContain('correlativo');
    expect(fields).toContain('monto_total');
    expect(fields).toContain('fecha_emision');
  });

  it('rechaza campos adicionales no declarados en el DTO (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('x-api-key', apiKey)
      .send({
        ...validPayload,
        campo_no_permitido: true,
      })
      .expect(400);
  });

  it('acepta un comprobante válido y devuelve HTTP 202', async () => {
    const createdAt = new Date('2026-10-09T10:00:00.000Z');

    mockInvoicesService.create.mockResolvedValue({
      id: 'invoice-test-001',
      estado: 'PENDIENTE',
      created_at: createdAt,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('x-api-key', apiKey)
      .send(validPayload)
      .expect(202);

    expect(response.body).toEqual({
      id: 'invoice-test-001',
      estado: 'PENDIENTE',
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: createdAt.toISOString(),
    });

    expect(mockInvoicesService.create).toHaveBeenCalledTimes(1);
  });
});
