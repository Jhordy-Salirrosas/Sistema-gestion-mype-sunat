import { Prisma } from '../../../src/generated/client/client';
import { PrismaService } from '../../../src/database/prismaService';
import { SireDashboardMetricsRepository } from '../../../src/modules/sire/infrastructure/persistence/sireDashboardMetricsRepository';

describe('SireDashboardMetricsRepository', () => {
  let rawQuery: jest.Mock;
  let repository: SireDashboardMetricsRepository;

  beforeEach(() => {
    rawQuery = jest.fn().mockResolvedValue([
      {
        totalCalls: 2,
        successfulCalls: 1,
        failedCalls: 1,
        totalRetries: 1,
        slowCalls: 0,
        bufferedInvoicesCount: 1,
        recentFailedCalls: 1,
      },
    ]);
    repository = new SireDashboardMetricsRepository({
      $queryRaw: rawQuery,
    } as unknown as PrismaService);
  });

  it('aggregates calls, failures, latency, queue and recent failures by tenant', async () => {
    const start = new Date('2026-10-29T11:55:00.000Z');
    const end = new Date('2026-10-29T12:00:00.000Z');

    await expect(
      repository.getMetricsSummary('company-a', start, end),
    ).resolves.toEqual({
      totalCalls: 2,
      successfulCalls: 1,
      failedCalls: 1,
      totalRetries: 1,
      slowCalls: 0,
      bufferedInvoicesCount: 1,
      recentFailedCalls: 1,
    });

    const query = rawQuery.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.sql).toContain('WHERE company.id = ?');
    expect(query.sql).toContain('history.created_at >= ?::timestamp');
    expect(query.sql).toContain('history.created_at <= ?::timestamp');
    expect(query.sql).toContain('history.http_status_code IS NOT NULL');
    expect(query.sql).toContain('history.http_status_code >= 500');
    expect(query.sql).toContain('history.intento > 1');
    expect(query.sql).toContain("history.codigo_error !~ '^[0-9]{4}$'");
    expect(query.sql).toContain("'ENVIADO'::\"InvoiceStatus\"");
    expect(query.sql).toContain(
      "history.codigo_error IS DISTINCT FROM 'MAX_REINTENTOS'",
    );
    expect(query.sql).toContain('history.tiempo_respuesta_ms >= ?');
    expect(query.sql).toContain("estado::text IN ('PENDIENTE', 'EN_COLA')");
    expect(query.values).toEqual([5000, start, end, 'company-a', 'company-a']);
  });

  it('aggregates recorded retries and observed outcomes per company and time bucket', async () => {
    rawQuery.mockResolvedValue([]);
    const start = new Date('2026-10-29T11:00:00.000Z');
    const end = new Date('2026-10-29T12:00:00.000Z');

    await repository.getHistory(
      'company-b',
      start,
      end,
      'hour',
      100,
      0,
    );

    const query = rawQuery.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.sql).toContain('INNER JOIN invoices AS invoice');
    expect(query.sql).toContain('invoice.company_id = ?');
    expect(query.sql).toContain('history.intento > 1');
    expect(query.sql).toContain(
      "history.codigo_error IS DISTINCT FROM 'MAX_REINTENTOS'",
    );
    expect(query.sql).toContain('date_trunc(?, history.created_at)');
    expect(query.values).toEqual([
      'hour',
      start,
      'hour',
      end,
      'hour',
      'hour',
      'company-b',
      start,
      end,
      101,
      0,
    ]);
  });

  it('propagates storage errors for the backend exception filter', async () => {
    rawQuery.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      repository.getMetricsSummary(
        'company-a',
        new Date('2026-10-29T11:55:00.000Z'),
        new Date('2026-10-29T12:00:00.000Z'),
      ),
    ).rejects.toThrow('database unavailable');
  });
});
