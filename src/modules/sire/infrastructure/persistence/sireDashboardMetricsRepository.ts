import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import { PrismaService } from '../../../../database/prismaService';
import { SireDashboardGranularity } from '../../application/dto/sireDashboardHistoryQueryDto';

export interface SireDashboardHistoryRow {
  timestamp: Date;
  retries: number;
  observedCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface SireDashboardMetricsSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalRetries: number;
  slowCalls: number;
  bufferedInvoicesCount: number;
  recentFailedCalls: number;
}

export const SLOW_CALL_THRESHOLD_MS = 5_000;

const OBSERVED_CALL = Prisma.sql`(
  history.http_status_code IS NOT NULL
  OR history.codigo_error ~ '^[0-9]+$'
  OR history.estado_nuevo IN (
    'ERROR_RED'::"InvoiceStatus",
    'ENVIADO'::"InvoiceStatus"
  )
)`;

const FAILED_CALL = Prisma.sql`(
  history.estado_nuevo IN (
    'ERROR_RED'::"InvoiceStatus",
    'ENVIADO'::"InvoiceStatus"
  )
  AND (history.http_status_code IS NULL OR history.http_status_code >= 500)
  AND (
    history.codigo_error IS NULL
    OR (
      history.codigo_error !~ '^[0-9]{4}$'
      AND history.codigo_error <> 'SOAP_FAULT'
    )
  )
)`;

@Injectable()
export class SireDashboardMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMetricsSummary(
    companyId: string,
    start: Date,
    end: Date,
  ): Promise<SireDashboardMetricsSummary> {
    const [row] = await this.prisma.$queryRaw<SireDashboardMetricsSummary[]>(
      Prisma.sql`
        SELECT
          COUNT(history.id)::int AS "totalCalls",
          (
            COUNT(history.id) FILTER (
              WHERE ${OBSERVED_CALL} AND NOT ${FAILED_CALL}
            )
          )::int AS "successfulCalls",
          (
            COUNT(history.id) FILTER (
              WHERE ${OBSERVED_CALL} AND ${FAILED_CALL}
            )
          )::int AS "failedCalls",
          COUNT(history.id) FILTER (
            WHERE ${OBSERVED_CALL} AND history.intento > 1
          )::int AS "totalRetries",
          (
            COUNT(history.id) FILTER (
              WHERE ${OBSERVED_CALL}
                AND history.tiempo_respuesta_ms >= ${SLOW_CALL_THRESHOLD_MS}
            )
          )::int AS "slowCalls",
          (
            COUNT(history.id) FILTER (
              WHERE ${OBSERVED_CALL} AND ${FAILED_CALL}
                AND history.created_at >= ${start}::timestamp
                AND history.created_at <= ${end}::timestamp
            )
          )::int AS "recentFailedCalls",
          (
            SELECT COUNT(*)::int
            FROM invoices AS queued_invoice
            WHERE queued_invoice.company_id = ${companyId}
              AND queued_invoice.estado::text IN ('PENDIENTE', 'EN_COLA')
          ) AS "bufferedInvoicesCount"
        FROM companies AS company
        LEFT JOIN invoices AS invoice
          ON invoice.company_id = company.id
        LEFT JOIN transaction_history AS history
          ON history.invoice_id = invoice.id
          AND history.codigo_error IS DISTINCT FROM 'MAX_REINTENTOS'
          AND ${OBSERVED_CALL}
        WHERE company.id = ${companyId}
      `,
    );

    if (!row) {
      throw new Error('La consulta de métricas no devolvió resultados.');
    }

    return row;
  }

  async getHistory(
    companyId: string,
    start: Date,
    end: Date,
    granularity: SireDashboardGranularity,
    limit: number,
    offset: number,
  ): Promise<SireDashboardHistoryRow[]> {
    return this.prisma.$queryRaw<SireDashboardHistoryRow[]>(
      Prisma.sql`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc(${granularity}, ${start}::timestamp),
            date_trunc(
              ${granularity},
              ${end}::timestamp - interval '1 millisecond'
            ),
            CASE ${granularity}
              WHEN 'minute' THEN interval '1 minute'
              WHEN 'hour' THEN interval '1 hour'
              ELSE interval '1 day'
            END
          ) AS timestamp
        ),
        activity AS (
          SELECT
            date_trunc(${granularity}, history.created_at) AS bucket,
            COUNT(*) FILTER (WHERE ${OBSERVED_CALL})::int AS "observedCalls",
            COUNT(*) FILTER (
              WHERE ${OBSERVED_CALL} AND NOT ${FAILED_CALL}
            )::int AS "successfulCalls",
            COUNT(*) FILTER (
              WHERE ${OBSERVED_CALL} AND ${FAILED_CALL}
            )::int AS "failedCalls",
            COUNT(*) FILTER (
              WHERE history.intento > 1
            )::int AS retries
          FROM transaction_history AS history
          INNER JOIN invoices AS invoice ON invoice.id = history.invoice_id
          WHERE invoice.company_id = ${companyId}
            AND history.created_at >= ${start}
            AND history.created_at < ${end}
            AND history.codigo_error IS DISTINCT FROM 'MAX_REINTENTOS'
            AND ${OBSERVED_CALL}
          GROUP BY bucket
        )
        SELECT
          buckets.timestamp,
          COALESCE(activity.retries, 0)::int AS retries,
          COALESCE(activity."observedCalls", 0)::int AS "observedCalls",
          COALESCE(activity."successfulCalls", 0)::int AS "successfulCalls",
          COALESCE(activity."failedCalls", 0)::int AS "failedCalls"
        FROM buckets
        LEFT JOIN activity ON activity.bucket = buckets.timestamp
        ORDER BY buckets.timestamp ASC
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `,
    );
  }
}
