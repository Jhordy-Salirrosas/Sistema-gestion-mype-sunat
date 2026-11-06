import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { issuerConfigHarness } from '../../fixtures/issuerConfigHarness';
import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';
import { InvoiceSeriesService } from '../../../src/modules/invoices/application/services/invoiceSeriesService';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('D1 Config HTTP contract without optional PostgreSQL flag', () => {
  const environment = { ...process.env };
  let app: INestApplication;
  let h: ReturnType<typeof issuerConfigHarness>;
  let jwt: NativeJwtAdapter;
  const series = {
    listar: jest.fn(async () => []),
    asegurarSerie: jest.fn(async (input) => input),
  };
  const token = (role = 'ADMIN', companyId = 'fake-company') =>
    jwt.signToken({
      sub: 'fake-user',
      email: 'fake@example.invalid',
      companyId,
      role,
    });
  const put = (body: unknown, auth = token()) =>
    request(app.getHttpServer())
      .put('/api/v1/invoices/config')
      .set('Authorization', `Bearer ${auth}`)
      .send(body);
  beforeAll(async () => {
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString(
      'base64',
    );
    h = issuerConfigHarness();
    jwt = new NativeJwtAdapter(
      new ConfigService({ JWT_SECRET: 'obviously-fake-unit-http-key' }),
    );
    const config = new InvoiceConfigService(
      series as never,
      h.certificates as never,
      h.resolver,
      h.writer,
    );
    const module = await Test.createTestingModule({
      controllers: [InvoiceConfigController],
      providers: [
        { provide: InvoiceConfigService, useValue: config },
        { provide: InvoiceSeriesService, useValue: series },
        { provide: TOKEN_SERVICE_PORT, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    process.env = environment;
  });
  it('authenticates GET and PUT using the existing guards', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/invoices/config')
      .expect(401);
    await request(app.getHttpServer())
      .put('/api/v1/invoices/config')
      .send({})
      .expect(401);
    await put({ entorno: 'MOCK' }, token('CONTADOR')).expect(403);
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });
  it('saves with 200 and reads only the public projection', async () => {
    const response = await put({
      entorno: 'MOCK',
      sol_user: 'FAKE_PRIVATE_USER',
      sol_password: 'obviously-fake-private-password',
    }).expect(200);
    expect(response.body).toMatchObject({
      origen_efectivo: 'company',
      origen_sol: 'company',
      sol_password_configurada: true,
      ruc: h.company.ruc,
    });
    const read = await request(app.getHttpServer())
      .get('/api/v1/invoices/config')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);
    for (const serialized of [response.text, read.text])
      for (const value of [
        'obviously-fake-private-password',
        'FAKE_PRIVATE_USER',
        'sol_pass_encrypted',
        'cert_storage_url',
        'ciphertext',
      ])
        expect(serialized).not.toContain(value);
    expect(h.db.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'fake-company' },
    });
  });
  it.each([
    { companyId: 'fake-other-company' },
    { company_id: 'fake-other-company' },
    { ruc: '20000000002' },
    { cert_storage_url: 'https://public.invalid' },
    { action: 'bad' },
    { entorno: 'LIVE' },
    { sol_password: 'x'.repeat(257) },
  ])(
    'rejects closed DTO violations without reflecting supplied values: %j',
    async (body) => {
      const calls = h.db.$transaction.mock.calls.length;
      const response = await put(body).expect(400);
      expect(response.text).not.toContain('fake-other-company');
      expect(response.text).not.toContain('https://public.invalid');
      expect(h.db.$transaction).toHaveBeenCalledTimes(calls);
    },
  );
  it('resets explicitly and reports the effective deployment source', async () => {
    const response = await put({ action: 'reset' }).expect(200);
    expect(response.body.origen_efectivo).toBe('deployment');
    expect(h.company.issuer_config_activated_at).toBeNull();
  });
  it('does not expose infrastructure exception details', async () => {
    h.db.$transaction.mockRejectedValueOnce(
      new Error('obviously-fake-private-infrastructure-error'),
    );
    const response = await put({ entorno: 'MOCK' }).expect(503);
    expect(response.text).toContain('CONFIG_SAVE_FAILED');
    expect(response.text).not.toContain(
      'obviously-fake-private-infrastructure-error',
    );
  });
});

describe('D1 Config controller adjacent series validation branches', () => {
  const rows = [
    {
      document_type: '03',
      series: 'B001',
      current_correlative: 2,
      is_active: true,
    },
    {
      document_type: '01',
      series: 'F001',
      current_correlative: 7,
      is_active: true,
    },
  ];
  const series = {
    listar: jest.fn(async () => rows),
    asegurarSerie: jest.fn(async (input) => input),
  };
  const controller = new InvoiceConfigController({} as never, series as never);
  it('delegates series listing with the authenticated company', async () => {
    await expect(controller.listarSeries('fake-company')).resolves.toEqual(
      rows,
    );
    expect(series.listar).toHaveBeenLastCalledWith('fake-company');
  });
  it.each([
    {},
    { document_type: '99', series: 'X001' },
    { document_type: '01', series: 'B001' },
    { document_type: '01', series: 'F001', correlativo_inicial: -1 },
    { document_type: '01', series: 'F001', correlativo_inicial: 1.5 },
  ])('rejects invalid series input: %j', async (body) => {
    await expect(controller.crearSerie('fake-company', body)).rejects.toThrow();
  });
  it.each([undefined, 0, 10])(
    'keeps optional correlativo validation and tenant ownership: %s',
    async (correlativo) => {
      const body = {
        document_type: '01',
        series: 'F001',
        ...(correlativo === undefined
          ? {}
          : { correlativo_inicial: correlativo }),
      };
      await controller.crearSerie('fake-company', body);
      expect(series.asegurarSerie).toHaveBeenLastCalledWith({
        companyId: 'fake-company',
        documentType: '01',
        series: 'F001',
        correlativoInicial: correlativo,
      });
    },
  );
  it('normalizes type and series when projecting the next number, without reserving it', async () => {
    await expect(
      controller.siguienteCorrelativo('fake-company', '1', 'f001'),
    ).resolves.toEqual({
      serie: 'F001',
      document_type: '01',
      siguiente: 8,
      is_active: true,
    });
    expect(rows[1].current_correlative).toBe(7);
  });
  it('returns 404 for an unconfigured series', async () => {
    await expect(
      controller.siguienteCorrelativo('fake-company', '01', 'F999'),
    ).rejects.toThrow('no está configurada');
  });
});
