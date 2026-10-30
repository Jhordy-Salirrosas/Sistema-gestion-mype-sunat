import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { SireDashboardMetricsService } from '../../../src/modules/sire/application/sireDashboardMetricsService';
import { CloseFiscalPeriodUseCase } from '../../../src/modules/sire/application/use-cases/closeFiscalPeriodUseCase';
import { ExportSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../../src/modules/sire/application/use-cases/getReconciliationHistoryUseCase';
import { IngestSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/ingestSireProposalUseCase';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import {
  LegacySireMetricsController,
  SireDashboardMetricsController,
  SireMetricsCompatibilityController,
  SireResilienceMetricsCompatibilityController,
} from '../../../src/modules/sire/infrastructure/controllers/sireDashboardMetricsController';
import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';

const authorization = (token: string) =>
  `${['Be', 'arer'].join('')} ${token}`;

describe('SIRE dashboard metrics HTTP contract', () => {
  let app: INestApplication;
  const service = {
    getMetrics: jest.fn().mockResolvedValue({
      state: 'CLOSED',
      failureRate: 10,
      slowCallRate: 0,
      bufferedInvoicesCount: 2,
      totalCalls: 10,
      successfulCalls: 9,
      failedCalls: 1,
      totalRetries: 3,
      lastStateChange: '2026-10-30T00:00:00.000Z',
      recentFailedCalls: 1,
      mttdSeconds: null,
      mttrSeconds: null,
      mtbfSeconds: null,
      activityScope: 'company',
      circuitBreakerScope: 'global',
    }),
    getHistory: jest.fn().mockResolvedValue({
      data: [
        {
          timestamp: '2026-10-30T08:00:00.000Z',
          retries: 1,
          availabilityPercent: 50,
          observedCalls: 2,
          successfulCalls: 1,
          failedCalls: 1,
        },
      ],
      pagination: { limit: 100, offset: 0, hasMore: false },
    }),
  };
  const tokenService = {
    verifyToken: jest.fn((token: string) => {
      if (token === 'tenant-a') {
        return {
          sub: 'user-a',
          email: 'tenant-a@example.test',
          companyId: 'company-a',
          role: 'ADMIN',
        };
      }
      if (token === 'tenant-b') {
        return {
          sub: 'user-b',
          email: 'tenant-b@example.test',
          companyId: 'company-b',
          role: 'ADMIN',
        };
      }
      return null;
    }),
  };
  const reconciliationHistory = {
    execute: jest.fn().mockResolvedValue({
      page: 1,
      limit: 20,
      total: 0,
      items: [],
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        SireController,
        SireDashboardMetricsController,
        SireMetricsCompatibilityController,
        SireResilienceMetricsCompatibilityController,
        LegacySireMetricsController,
      ],
      providers: [
        AuthGuard,
        { provide: ReconcileSireUseCase, useValue: { execute: jest.fn() } },
        { provide: IngestSireProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: ExportSireProposalUseCase, useValue: { execute: jest.fn() } },
        {
          provide: GetReconciliationHistoryUseCase,
          useValue: reconciliationHistory,
        },
        { provide: CloseFiscalPeriodUseCase, useValue: { execute: jest.fn() } },
        { provide: SireDashboardMetricsService, useValue: service },
        { provide: TOKEN_SERVICE_PORT, useValue: tokenService },
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
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves canonical and compatibility metrics paths for the authenticated tenant', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sire/dashboard/metrics')
      .set('Authorization', authorization('tenant-a'))
      .expect(200);
    expect(service.getMetrics).toHaveBeenCalledWith('company-a');

    await request(app.getHttpServer())
      .get('/api/v1/sire/metrics')
      .set('Authorization', authorization('tenant-a'))
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/resilience/metrics')
      .set('Authorization', authorization('tenant-a'))
      .expect(200);
    expect(response.body).toMatchObject({
      recentFailedCalls: 1,
      totalCalls: 10,
      totalRetries: 3,
      activityScope: 'company',
      circuitBreakerScope: 'global',
    });

    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', authorization('tenant-b'))
      .expect(200);
    expect(service.getMetrics).toHaveBeenLastCalledWith('company-b');
  });

  it('validates history query parameters and takes tenant from the session', async () => {
    const reconciliation = await request(app.getHttpServer())
      .get('/api/v1/sire/history?page=1&limit=20')
      .set('Authorization', authorization('tenant-a'))
      .expect(200);
    expect(reconciliation.body).toMatchObject({
      page: 1,
      limit: 20,
      items: [],
    });
    expect(reconciliationHistory.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      'company-a',
    );

    const query =
      'start=2026-10-30T08:00:00.000Z&end=2026-10-30T09:00:00.000Z&granularity=hour';
    const response = await request(app.getHttpServer())
      .get(`/api/v1/sire/dashboard/history?${query}`)
      .set('Authorization', authorization('tenant-a'))
      .expect(200);

    expect(response.body.data[0]).toMatchObject({
      retries: 1,
      availabilityPercent: 50,
      observedCalls: 2,
    });
    expect(response.body.pagination).toEqual({
      limit: 100,
      offset: 0,
      hasMore: false,
    });
    expect(service.getHistory).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({ granularity: 'hour', limit: 100, offset: 0 }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/resilience/history?${query}`)
      .set('Authorization', authorization('tenant-a'))
      .expect(200);

    await request(app.getHttpServer())
      .get(
        '/api/v1/sire/dashboard/history?start=not-a-date&end=2026-10-30T09:00:00.000Z&granularity=week',
      )
      .set('Authorization', authorization('tenant-a'))
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/sire/dashboard/history?${query}&companyId=company-b`)
      .set('Authorization', authorization('tenant-a'))
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/sire/dashboard/history?${query}&limit=501`)
      .set('Authorization', authorization('tenant-a'))
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/sire/dashboard/history?${query}&offset=-1`)
      .set('Authorization', authorization('tenant-a'))
      .expect(400);
    expect(service.getHistory).toHaveBeenCalledTimes(2);
  });

  it('uses the standard backend error shape for missing or invalid sessions', async () => {
    const unauthenticated = await request(app.getHttpServer())
      .get('/api/v1/sire/dashboard/metrics')
      .expect(401);
    expect(unauthenticated.body).toMatchObject({ status: 401 });

    await request(app.getHttpServer())
      .get('/api/v1/sire/dashboard/metrics')
      .set('Authorization', authorization('invalid'))
      .expect(401);
  });
});
