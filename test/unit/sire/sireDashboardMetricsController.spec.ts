import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import {
  LegacySireMetricsController,
  SireDashboardMetricsController,
  SireMetricsCompatibilityController,
  SireResilienceMetricsCompatibilityController,
} from '../../../src/modules/sire/infrastructure/controllers/sireDashboardMetricsController';
import { SireDashboardMetricsService } from '../../../src/modules/sire/application/sireDashboardMetricsService';
import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';

describe('SIRE dashboard metrics routes', () => {
  const metrics = {
    getMetrics: jest.fn().mockResolvedValue({ recentFailedCalls: 1 }),
    getHistory: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes authenticated SIRE routes and keeps compatibility aliases', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SireDashboardMetricsController))
      .toBe('api/v1/sire/dashboard');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireDashboardMetricsController.prototype.getMetrics,
      ),
    ).toBe('metrics');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireDashboardMetricsController.prototype.getHistory,
      ),
    ).toBe('history');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SireDashboardMetricsController),
    ).toContain(AuthGuard);

    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireResilienceMetricsCompatibilityController,
      ),
    ).toBe('api/v1/resilience');
    expect(
      Reflect.getMetadata(PATH_METADATA, SireMetricsCompatibilityController),
    ).toBe('api/v1/sire');
    expect(Reflect.getMetadata(PATH_METADATA, SireController)).toBe(
      'api/v1/sire',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, SireController.prototype.history),
    ).toBe('history');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireDashboardMetricsController.prototype.getHistory,
      ),
    ).toBe('history');
    expect(Reflect.getMetadata(PATH_METADATA, LegacySireMetricsController))
      .toBe('api/v1');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, LegacySireMetricsController),
    ).toContain(AuthGuard);
  });

  it('uses the authenticated session company for metrics and history', async () => {
    const controller = new SireDashboardMetricsController(
      metrics as unknown as SireDashboardMetricsService,
    );
    const query = {
      start: '2026-10-29T11:00:00.000Z',
      end: '2026-10-29T12:00:00.000Z',
      granularity: 'hour',
      limit: 100,
      offset: 0,
    };

    await controller.getMetrics('company-from-session');
    await controller.getHistory(query, 'company-from-session');

    expect(metrics.getMetrics).toHaveBeenCalledWith('company-from-session');
    expect(metrics.getHistory).toHaveBeenCalledWith(
      'company-from-session',
      query,
    );
  });

  it('does not replace missing session company with a client-selected company', async () => {
    metrics.getMetrics.mockRejectedValueOnce(
      new UnauthorizedException('La empresa del usuario no está definida.'),
    );
    const controller = new SireDashboardMetricsController(
      metrics as unknown as SireDashboardMetricsService,
    );

    await expect(controller.getMetrics(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(metrics.getMetrics).toHaveBeenCalledWith(undefined);
  });
});
