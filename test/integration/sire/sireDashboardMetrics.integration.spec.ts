import { randomUUID } from 'node:crypto';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { PrismaService } from '../../../src/database/prismaService';
import { SireDashboardMetricsRepository } from '../../../src/modules/sire/infrastructure/persistence/sireDashboardMetricsRepository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('SIRE dashboard PostgreSQL aggregation', () => {
  let prisma: PrismaService;
  let repository: SireDashboardMetricsRepository;
  let companyIds: string[] = [];
  let invoiceIds: string[] = [];
  let tenantIds:
    | { companyA: string; companyB: string; companyWithoutInvoices: string }
    | undefined;

  const intervalStart = new Date('2026-10-30T08:00:00.000Z');
  const intervalEnd = new Date('2026-10-30T08:05:00.000Z');

  async function createCompany() {
    const company = await prisma.company.create({
      data: {
        ruc: `20${Math.floor(100_000_000 + Math.random() * 899_999_999)}`,
        legal_name: `RESILIENCE TEST ${randomUUID()}`,
        sol_user: 'test-user',
        sol_pass_encrypted: 'test-encrypted',
      },
    });
    companyIds.push(company.id);
    return company.id;
  }

  async function createInvoice(companyId: string, suffix: string) {
    const invoice = await prisma.invoice.create({
      data: {
        company_id: companyId,
        ruc_emisor: '20123456786',
        serie: `T${suffix}`,
        correlativo: 1,
        tipo_comprobante: '01',
        monto_total: 118,
        fecha_emision: intervalStart,
        estado: InvoiceStatus.PENDIENTE,
        payload_ubl: {},
      },
    });
    invoiceIds.push(invoice.id);
    return invoice.id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new SireDashboardMetricsRepository(prisma);

    const [companyA, companyB, companyWithoutInvoices] = await Promise.all([
      createCompany(),
      createCompany(),
      createCompany(),
    ]);
    tenantIds = { companyA, companyB, companyWithoutInvoices };
    const [invoiceA, invoiceB] = await Promise.all([
      createInvoice(companyA, 'RA'),
      createInvoice(companyB, 'RB'),
    ]);

    await prisma.transactionHistory.createMany({
      data: [
        {
          company_id: companyA,
          invoice_id: invoiceA,
          intento: 1,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'HTTP_503',
          tiempo_respuesta_ms: 5_000,
          created_at: intervalStart,
        },
        {
          company_id: companyA,
          invoice_id: invoiceA,
          intento: 2,
          estado_nuevo: InvoiceStatus.ACEPTADO,
          codigo_error: '0',
          tiempo_respuesta_ms: 100,
          created_at: new Date(intervalStart.getTime() + 2_000),
        },
        {
          company_id: companyA,
          invoice_id: invoiceA,
          intento: 2,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'MAX_REINTENTOS',
          tiempo_respuesta_ms: 100,
          created_at: new Date(intervalStart.getTime() + 3_000),
        },
        {
          company_id: companyA,
          invoice_id: invoiceA,
          intento: 1,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: '0102',
          http_status_code: 500,
          tiempo_respuesta_ms: 500,
          created_at: new Date(intervalStart.getTime() + 4_000),
        },
        {
          company_id: companyA,
          invoice_id: invoiceA,
          intento: 3,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'TIMEOUT',
          tiempo_respuesta_ms: 1_000,
          created_at: intervalEnd,
        },
        {
          company_id: companyB,
          invoice_id: invoiceB,
          intento: 1,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'HTTP_503',
          tiempo_respuesta_ms: 400,
          created_at: intervalEnd,
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (invoiceIds.length) {
        await prisma.invoice.deleteMany({
          where: { id: { in: invoiceIds } },
        });
      }
      if (companyIds.length) {
        await prisma.company.deleteMany({
          where: { id: { in: companyIds } },
        });
      }
      await prisma.$disconnect();
    }
  });

  it('counts exact five-minute boundaries and aggregates only the owning tenant', async () => {
    const { companyA, companyB, companyWithoutInvoices } = tenantIds!;
    const [summaryA, summaryB, emptySummary] = await Promise.all([
      repository.getMetricsSummary(companyA!, intervalStart, intervalEnd),
      repository.getMetricsSummary(companyB!, intervalStart, intervalEnd),
      repository.getMetricsSummary(
        companyWithoutInvoices!,
        intervalStart,
        intervalEnd,
      ),
    ]);

    expect(summaryA).toEqual({
      totalCalls: 4,
      successfulCalls: 2,
      failedCalls: 2,
      totalRetries: 2,
      slowCalls: 1,
      bufferedInvoicesCount: 1,
      recentFailedCalls: 2,
    });
    expect(summaryB).toEqual({
      totalCalls: 1,
      successfulCalls: 0,
      failedCalls: 1,
      totalRetries: 0,
      slowCalls: 0,
      bufferedInvoicesCount: 1,
      recentFailedCalls: 1,
    });
    expect(emptySummary).toEqual({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalRetries: 0,
      slowCalls: 0,
      bufferedInvoicesCount: 0,
      recentFailedCalls: 0,
    });
  });

  it('returns actual retry and outcome counts for one tenant and excludes end boundary from history', async () => {
    const { companyA } = tenantIds!;
    const points = await repository.getHistory(
      companyA!,
      intervalStart,
      intervalEnd,
      'minute',
      10,
      0,
    );

    expect(points).toHaveLength(5);
    expect(points[0]).toMatchObject({
      timestamp: intervalStart,
      retries: 1,
      observedCalls: 3,
      successfulCalls: 2,
      failedCalls: 1,
    });
    expect(points[4]).toMatchObject({
      timestamp: new Date(intervalStart.getTime() + 4 * 60_000),
      retries: 0,
      observedCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
    });
  });
});
