import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SireDashboardMetricsService } from '../../../src/modules/sire/application/sireDashboardMetricsService';
import { SireDashboardMetricsRepository } from '../../../src/modules/sire/infrastructure/persistence/sireDashboardMetricsRepository';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';

describe('SireDashboardMetricsService', () => {
  let state: ResilienceStateService;
  let history: {
    getMetricsSummary: jest.Mock;
    getHistory: jest.Mock;
  };
  let service: SireDashboardMetricsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T12:00:00.000Z'));
    state = new ResilienceStateService();
    history = {
      getMetricsSummary: jest.fn().mockResolvedValue({
        totalCalls: 4,
        successfulCalls: 3,
        failedCalls: 1,
        totalRetries: 2,
        slowCalls: 2,
        bufferedInvoicesCount: 3,
        recentFailedCalls: 2,
      }),
      getHistory: jest.fn(),
    };
    service = new SireDashboardMetricsService(
      state,
      history as unknown as SireDashboardMetricsRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds tenant metrics from persisted activity and a five-minute window', async () => {
    const metrics = await service.getMetrics('company-a');

    expect(history.getMetricsSummary).toHaveBeenCalledWith(
      'company-a',
      new Date('2026-10-29T11:55:00.000Z'),
      new Date('2026-10-29T12:00:00.000Z'),
    );
    expect(metrics).toEqual(
      expect.objectContaining({
        state: 'CLOSED',
        failureRate: 25,
        slowCallRate: 50,
        bufferedInvoicesCount: 3,
        totalCalls: 4,
        successfulCalls: 3,
        failedCalls: 1,
        totalRetries: 2,
        lastStateChange: expect.any(String),
        recentFailedCalls: 2,
        mttdSeconds: null,
        mttrSeconds: null,
        mtbfSeconds: null,
        activityScope: 'company',
        circuitBreakerScope: 'global',
      }),
    );
  });

  it('does not allow metrics without the authenticated company context', async () => {
    await expect(service.getMetrics(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(history.getMetricsSummary).not.toHaveBeenCalled();
  });

  it('propagates metric storage errors instead of returning zero counters', async () => {
    history.getMetricsSummary.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(service.getMetrics('company-a')).rejects.toThrow(
      'database unavailable',
    );
  });

  it('returns interval availability, retries, and observed-call counters', async () => {
    history.getHistory.mockResolvedValue([
      {
        timestamp: new Date('2026-10-29T11:00:00.000Z'),
        retries: 2,
        observedCalls: 4,
        successfulCalls: 3,
        failedCalls: 1,
      },
    ]);

    const response = await service.getHistory('company-a', {
      start: '2026-10-29T11:00:00.000Z',
      end: '2026-10-29T12:00:00.000Z',
      granularity: 'hour',
      limit: 100,
      offset: 0,
    });

    expect(response).toEqual({
      data: [
        {
          timestamp: '2026-10-29T11:00:00.000Z',
          retries: 2,
          availabilityPercent: 75,
          observedCalls: 4,
          successfulCalls: 3,
          failedCalls: 1,
        },
      ],
      pagination: { limit: 100, offset: 0, hasMore: false },
    });
    expect(history.getHistory).toHaveBeenCalledWith(
      'company-a',
      new Date('2026-10-29T11:00:00.000Z'),
      new Date('2026-10-29T12:00:00.000Z'),
      'hour',
      100,
      0,
    );
  });

  it('marks empty intervals unavailable instead of reporting 100 percent', async () => {
    history.getHistory.mockResolvedValue([
      {
        timestamp: new Date('2026-10-29T11:00:00.000Z'),
        retries: 0,
        observedCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      },
    ]);

    const response = await service.getHistory('company-a', {
      start: '2026-10-29T11:00:00.000Z',
      end: '2026-10-29T12:00:00.000Z',
      granularity: 'hour',
      limit: 100,
      offset: 0,
    });

    expect(response.data[0]?.availabilityPercent).toBeNull();
    expect(response.data[0]?.observedCalls).toBe(0);
  });

  it('returns an empty result for a valid range with no buckets', async () => {
    history.getHistory.mockResolvedValue([]);

    await expect(
      service.getHistory('company-a', {
        start: '2026-10-29T11:00:00.000Z',
        end: '2026-10-29T12:00:00.000Z',
        granularity: 'hour',
        limit: 100,
        offset: 0,
      }),
    ).resolves.toEqual({
      data: [],
      pagination: { limit: 100, offset: 0, hasMore: false },
    });
  });

  it('rejects invalid and oversized ranges', async () => {
    await expect(
      service.getHistory('company-a', {
        start: 'invalid',
        end: '2026-10-29T12:00:00.000Z',
        granularity: 'hour',
        limit: 100,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.getHistory('company-a', {
        start: '2026-10-29T12:00:00.000Z',
        end: '2026-10-29T12:00:00.000Z',
        granularity: 'hour',
        limit: 100,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.getHistory('company-a', {
        start: '2025-01-01T00:00:00.000Z',
        end: '2026-10-29T00:00:00.000Z',
        granularity: 'minute',
        limit: 100,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(history.getHistory).not.toHaveBeenCalled();
  });

  it('validates pagination without dropping extra points silently', async () => {
    history.getHistory.mockResolvedValue([
      {
        timestamp: new Date('2026-10-29T10:00:00.000Z'),
        retries: 0,
        observedCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
      },
      {
        timestamp: new Date('2026-10-29T11:00:00.000Z'),
        retries: 0,
        observedCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
      },
    ]);

    const result = await service.getHistory('company-a', {
      start: '2026-10-29T10:00:00.000Z',
      end: '2026-10-29T12:00:00.000Z',
      granularity: 'hour',
      limit: 1,
      offset: 0,
    });
    expect(result.data).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
  });
});
