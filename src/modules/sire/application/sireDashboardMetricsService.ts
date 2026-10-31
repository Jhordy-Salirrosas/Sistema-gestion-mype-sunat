import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SireDashboardGranularity,
  SireDashboardHistoryQueryDto,
} from './dto/sireDashboardHistoryQueryDto';
import {
  ResilienceStateService,
  type CircuitBreakerSnapshot,
} from '../../resilience/application/resilienceStateService';
import { SireDashboardMetricsRepository } from '../infrastructure/persistence/sireDashboardMetricsRepository';

const GRANULARITY_MS: Record<SireDashboardGranularity, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};
const MAX_HISTORY_BUCKETS = 10_000;
const MAX_HISTORY_RANGE_MS = 365 * GRANULARITY_MS.day;

export interface SireDashboardHistoryPoint {
  timestamp: string;
  retries: number;
  availabilityPercent: number | null;
  observedCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface SireDashboardHistoryResponse {
  data: SireDashboardHistoryPoint[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SireDashboardMetrics extends CircuitBreakerSnapshot {
  failureRate: number;
  slowCallRate: number;
  bufferedInvoicesCount: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalRetries: number;
  recentFailedCalls: number;
  mttdSeconds: number | null;
  mttrSeconds: number | null;
  mtbfSeconds: number | null;
  activityScope: 'company';
}

@Injectable()
export class SireDashboardMetricsService {
  constructor(
    private readonly state: ResilienceStateService,
    private readonly history: SireDashboardMetricsRepository,
  ) {}

  async getMetrics(companyId?: string): Promise<SireDashboardMetrics> {
    const tenantId = this.requireCompany(companyId);
    const now = new Date();
    const summary = await this.history.getMetricsSummary(
      tenantId,
      new Date(now.getTime() - 5 * GRANULARITY_MS.minute),
      now,
    );

    return {
      ...this.state.snapshot(),
      failureRate: this.percentage(summary.failedCalls, summary.totalCalls),
      slowCallRate: this.percentage(summary.slowCalls, summary.totalCalls),
      bufferedInvoicesCount: summary.bufferedInvoicesCount,
      totalCalls: summary.totalCalls,
      successfulCalls: summary.successfulCalls,
      failedCalls: summary.failedCalls,
      totalRetries: summary.totalRetries,
      recentFailedCalls: summary.recentFailedCalls,
      mttdSeconds: null,
      mttrSeconds: null,
      mtbfSeconds: null,
      activityScope: 'company',
    };
  }

  async getHistory(
    companyId: string | undefined,
    query: SireDashboardHistoryQueryDto,
  ): Promise<SireDashboardHistoryResponse> {
    const tenantId = this.requireCompany(companyId);
    const start = new Date(query.start);
    const end = new Date(query.end);
    this.validateRange(start, end, query.granularity);

    const rows = await this.history.getHistory(
      tenantId,
      start,
      end,
      query.granularity,
      query.limit,
      query.offset,
    );
    const hasMore = rows.length > query.limit;
    const points = rows.slice(0, query.limit).map((row) => ({
      timestamp: row.timestamp.toISOString(),
      retries: row.retries,
      availabilityPercent:
        row.observedCalls === 0
          ? null
          : Math.round(
              (row.successfulCalls * 10_000) / row.observedCalls,
            ) / 100,
      observedCalls: row.observedCalls,
      successfulCalls: row.successfulCalls,
      failedCalls: row.failedCalls,
    }));

    return {
      data: points,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        hasMore,
      },
    };
  }

  private requireCompany(companyId?: string): string {
    if (!companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    return companyId;
  }

  private percentage(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value * 100) / total);
  }

  private validateRange(
    start: Date,
    end: Date,
    granularity: SireDashboardGranularity,
  ): void {
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      throw new BadRequestException(
        'El rango debe contener fechas válidas y start debe ser anterior a end.',
      );
    }

    const bucketSizeMs = GRANULARITY_MS[granularity];
    if (!bucketSizeMs) {
      throw new BadRequestException('La granularidad seleccionada no es válida.');
    }

    const rangeMs = end.getTime() - start.getTime();
    const firstBucket = Math.floor(start.getTime() / bucketSizeMs);
    const lastBucket = Math.floor((end.getTime() - 1) / bucketSizeMs);
    const bucketCount = lastBucket - firstBucket + 1;
    if (
      rangeMs > MAX_HISTORY_RANGE_MS ||
      bucketCount > MAX_HISTORY_BUCKETS
    ) {
      throw new BadRequestException(
        'El rango supera el máximo permitido para la granularidad seleccionada.',
      );
    }
  }
}
