import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { SireDashboardMetricsService } from '../../../src/modules/sire/application/sireDashboardMetricsService';
import { SireTicketManagerService } from '../../../src/modules/sire/application/sireTicketManagerService';
import { GetSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/getSireProposalUseCase';
import { RegisterSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/registerSirePreliminaryUseCase';
import { GenerateSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/generateSireRecordUseCase';
import { ExcludeSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/excludeSireRecordUseCase';
import { ReplaceSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/replaceSireProposalUseCase';
import { DeleteSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/deleteSirePreliminaryUseCase';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import { IngestSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/ingestSireProposalUseCase';
import { ExportSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../../src/modules/sire/application/use-cases/getReconciliationHistoryUseCase';
import { CloseFiscalPeriodUseCase } from '../../../src/modules/sire/application/use-cases/closeFiscalPeriodUseCase';
import { UploadSireReportUseCase } from '../../../src/modules/sire/application/use-cases/uploadSireReportUseCase';
import { SIRE_REPOSITORY_PORT } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';
import { SIRE_SUNAT_GATEWAY } from '../../../src/modules/sire/domain/ports/sireSunatGatewayPort';
import { MockSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/mockSireSunatGateway';
import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';
import { AcceptSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/acceptSireProposalUseCase';
import { RestoreSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/restoreSireRecordUseCase';
import type { SireProposalRecord } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';

const authHeader = 'Bearer mock-tenant';

describe('SIRE mock lifecycle HTTP flow', () => {
  let app: INestApplication;
  let now: number;
  const periods = new Map<string, { state: string; ticket: string | null; ticketOperation: string | null }>();
  const proposals = new Map<string, { id: string; origin: 'SUNAT' | 'USUARIO'; periodState: string }>();
  const periodProposals = new Map<string, SireProposalRecord[]>();

  const repository = {
    upsertPeriod: jest.fn(async (_companyId: string, period: string, bookType: string) => {
      const key = `${period}:${bookType}`;
      const value = periods.get(key) ?? { state: 'PROPUESTA', ticket: null, ticketOperation: null };
      periods.set(key, value);
      return { id: key, state: value.state };
    }),
    getPeriod: jest.fn(async (_companyId: string, period: string, bookType: string) => {
      const value = periods.get(`${period}:${bookType}`);
      return value ? { id: `${period}:${bookType}`, ...value } : null;
    }),
    saveSunatProposal: jest.fn(async (_companyId: string, period: string, bookType: 'RVIE' | 'RCE', records: Array<Omit<SireProposalRecord, 'id'>>) => {
      const key = `${period}:${bookType}`;
      periods.set(key, { state: 'PROPUESTA', ticket: null, ticketOperation: null });
      periodProposals.set(
        key,
        records.map((record, index) => ({
          ...record,
          id: `proposal-${period}-${index + 1}`,
        })),
      );
      records.forEach((record, index) => {
        proposals.set(`proposal-${index + 1}`, {
          id: `proposal-${index + 1}`,
          origin: record.origin ?? 'SUNAT',
          periodState: 'PROPUESTA',
        });
      });
    }),
    getPeriodProposals: jest.fn(async (_companyId: string, period: string, bookType: 'RVIE' | 'RCE') =>
      periodProposals.get(`${period}:${bookType}`) ?? [],
    ),
    setPeriodTicket: jest.fn(async (_companyId: string, period: string, bookType: string, state: string, ticket: string, operation: string) => {
      periods.set(`${period}:${bookType}`, { state, ticket, ticketOperation: operation });
    }),
    setPeriodState: jest.fn(async (_companyId: string, period: string, bookType: string, state: string) => {
      periods.set(`${period}:${bookType}`, { state, ticket: null, ticketOperation: null });
    }),
    getProposal: jest.fn(async (_companyId: string, proposalId: string) => proposals.get(proposalId) ?? null),
    excludeSunatProposal: jest.fn().mockResolvedValue(undefined),
    restoreProposal: jest.fn().mockResolvedValue(undefined),
  } as never;

  beforeAll(async () => {
    jest.useFakeTimers();
    now = Date.parse('2026-11-02T15:00:00.000Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const gateway = new MockSireSunatGateway();
    const moduleRef = await Test.createTestingModule({
      controllers: [SireController],
      providers: [
        AuthGuard,
        { provide: TOKEN_SERVICE_PORT, useValue: { verifyToken: jest.fn().mockReturnValue({ sub: 'user', email: 'test@example.test', companyId: 'company-a', role: 'ADMIN' }) } },
        { provide: SIRE_REPOSITORY_PORT, useValue: repository },
        { provide: SIRE_SUNAT_GATEWAY, useValue: gateway },
        GetSireProposalUseCase,
        ExcludeSireRecordUseCase,
        ReplaceSireProposalUseCase,
        RegisterSirePreliminaryUseCase,
        DeleteSirePreliminaryUseCase,
        GenerateSireRecordUseCase,
        SireTicketManagerService,
        AcceptSireProposalUseCase,
        RestoreSireRecordUseCase,
        { provide: ReconcileSireUseCase, useValue: { execute: jest.fn() } },
        { provide: IngestSireProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: ExportSireProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: GetReconciliationHistoryUseCase, useValue: { execute: jest.fn() } },
        { provide: CloseFiscalPeriodUseCase, useValue: { execute: jest.fn() } },
        { provide: UploadSireReportUseCase, useValue: { execute: jest.fn() } },
        { provide: SireDashboardMetricsService, useValue: { getMetrics: jest.fn(), getHistory: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    await app.close();
  });

  it('moves from proposal to preliminary and generated through HTTP polling', async () => {
    const body = { period: '202611', bookType: 'RCE_COMPRAS' };

    await request(app.getHttpServer())
      .post('/api/v1/sire/proposal')
      .set('Authorization', authHeader)
      .send(body)
      .expect(201)
      .expect(({ body: response }) => {
        expect(response).toMatchObject({ state: 'PROPUESTA', count: 3 });
        expect(response.proposals).toHaveLength(3);
        expect(response.proposals[0]).toHaveProperty('id');
      });

    const preliminary = await request(app.getHttpServer())
      .post('/api/v1/sire/preliminary')
      .set('Authorization', authHeader)
      .send(body)
      .expect(201);
    expect(preliminary.body).toMatchObject({ ticket: 'TICKET-MOCK-002', state: 'PROCESANDO_PRELIMINAR' });

    now += 3001;
    await request(app.getHttpServer())
      .post('/api/v1/sire/tickets/202611/poll?bookType=RCE_COMPRAS')
      .set('Authorization', authHeader)
      .expect(201)
      .expect(({ body: response }) => expect(response).toMatchObject({ status: 'TERMINADO', state: 'CON_PRELIMINAR' }));

    const generated = await request(app.getHttpServer())
      .post('/api/v1/sire/generate')
      .set('Authorization', authHeader)
      .send(body)
      .expect(201);
    expect(generated.body).toMatchObject({ ticket: 'TICKET-MOCK-003', state: 'PROCESANDO_GENERACION' });

    now += 3001;
    await request(app.getHttpServer())
      .post('/api/v1/sire/tickets/202611/poll?bookType=RCE_COMPRAS')
      .set('Authorization', authHeader)
      .expect(201)
      .expect(({ body: response }) => expect(response).toMatchObject({ status: 'TERMINADO', state: 'GENERADO' }));
  });

  it('serves the provisional frontend route aliases', async () => {
    const query = 'ruc=20123456789&periodo=202612&libro=RCE';
    await request(app.getHttpServer())
      .get(`/sire/propuesta?${query}`)
      .set('Authorization', authHeader)
      .expect(200)
      .expect(({ body: response }) => {
        expect(response).toMatchObject({ state: 'PROPUESTA', count: 3 });
        expect(response.proposals[0]).toHaveProperty('id');
      });

    await request(app.getHttpServer())
      .get(`/sire/preliminar?${query}`)
      .set('Authorization', authHeader)
      .expect(200)
      .expect(({ body: response }) =>
        expect(response).toMatchObject({ period: '202612', bookType: 'RCE_COMPRAS' }),
      );

    await request(app.getHttpServer())
      .get(`/sire/generado?${query}`)
      .set('Authorization', authHeader)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/sire/status?${query}`)
      .set('Authorization', authHeader)
      .expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ status: 'SIN_TICKET' }));

    await request(app.getHttpServer())
      .post('/sire/aceptar')
      .set('Authorization', authHeader)
      .send({ period: '202612', bookType: 'RCE_COMPRAS', confirmed: true })
      .expect(201)
      .expect(({ body: response }) =>
        expect(response).toMatchObject({ state: 'PROCESANDO_PRELIMINAR' }),
      );

    await request(app.getHttpServer())
      .post('/sire/restaurar')
      .set('Authorization', authHeader)
      .send({ proposalId: 'proposal-1' })
      .expect(201);
  });
});
