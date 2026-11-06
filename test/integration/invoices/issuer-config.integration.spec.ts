import * as forge from 'node-forge';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { IssuerConfigEncryption } from '../../../src/modules/sunat/issuerConfigEncryption';
import { IssuerConfigResolver } from '../../../src/modules/sunat/issuerConfigResolver';
import { CertificateService } from '../../../src/modules/sunat/certificate.service';
import { IssuerConfigWriter } from '../../../src/modules/invoices/application/services/issuerConfigWriter';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';
import { InvoiceSeriesService } from '../../../src/modules/invoices/application/services/invoiceSeriesService';
import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';

// Opt in explicitly. Refuse any other database, including remote ta13_test instances.
const enabled = process.env.RUN_D1_DB_TESTS === '1';
(enabled ? describe : describe.skip)(
  'D1 PostgreSQL persistence and Config HTTP E2E',
  () => {
    let prisma: PrismaService;
    let app: INestApplication;
    let resolver: IssuerConfigResolver;
    let writer: IssuerConfigWriter;
    let jwt: NativeJwtAdapter;
    let a: string, b: string;
    const env = { ...process.env };
    const secret = 'obviously-fake-D1-sol-password';
    const token = (id = a, role = 'ADMIN') =>
      jwt.signToken({
        sub: 'fake-admin',
        email: 'fake@example.invalid',
        companyId: id,
        role,
      });
    const put = (body: unknown, auth = token()) =>
      request(app.getHttpServer())
        .put('/api/v1/invoices/config')
        .set('Authorization', `Bearer ${auth}`)
        .send(body);
    const get = (id = a) =>
      request(app.getHttpServer())
        .get('/api/v1/invoices/config')
        .set('Authorization', `Bearer ${token(id)}`);
    beforeAll(async () => {
      const url = new URL(
        process.env.D1_TEST_DATABASE_URL ??
          'postgresql://postgres:test@127.0.0.1:5435/ta13_test',
      );
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.pathname !== '/ta13_test'
      )
        throw new Error('Only local ta13_test is permitted');
      process.env.DATABASE_URL = url.toString();
      process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString(
        'base64',
      );
      process.env.SUNAT_SOL_USER = 'FAKE_BACKUP';
      process.env.SUNAT_SOL_PASSWORD = 'obviously-fake-backup';
      prisma = new PrismaService();
      await prisma.$connect();
      const module = await Test.createTestingModule({
        controllers: [InvoiceConfigController],
        providers: [
          InvoiceSeriesService,
          InvoiceConfigService,
          IssuerConfigWriter,
          IssuerConfigEncryption,
          IssuerConfigResolver,
          CertificateService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: TOKEN_SERVICE_PORT,
            useFactory: () => {
              jwt = new NativeJwtAdapter(
                new ConfigService({
                  JWT_SECRET: 'obviously-fake-d1-test-signing-secret',
                }),
              );
              return jwt;
            },
          },
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      resolver = module.get(IssuerConfigResolver);
      writer = module.get(IssuerConfigWriter);
    });
    beforeEach(async () => {
      a = randomUUID();
      b = randomUUID();
      await prisma.company.createMany({
        data: [a, b].map((id, index) => ({
          id,
          ruc: `${index + 2}${Date.now().toString().slice(-10)}`,
          legal_name: 'Obviously Fake D1 Fixture',
          sol_user: 'legacy-fake',
          sol_pass_encrypted: 'legacy-fake',
        })),
      });
    });
    afterEach(async () => {
      await prisma.issuerCertificate.deleteMany({
        where: { company_id: { in: [a, b] } },
      });
      await prisma.company.deleteMany({ where: { id: { in: [a, b] } } });
    });
    afterAll(async () => {
      await app?.close();
      await prisma?.$disconnect();
      process.env = env;
    });
    it('stores encrypted data, survives a new resolver and returns only a safe projection', async () => {
      const response = await put({
        entorno: 'MOCK',
        sol_user: 'FAKE_TENANT',
        sol_password: secret,
      }).expect(200);
      expect(response.body).toMatchObject({
        origen_efectivo: 'company',
        sol_password_configurada: true,
        entorno: 'MOCK',
      });
      const row = await prisma.company.findUniqueOrThrow({ where: { id: a } });
      expect(row.sol_pass_encrypted).not.toContain(secret);
      const fresh = new IssuerConfigResolver(
        prisma,
        new IssuerConfigEncryption(),
      );
      expect((await fresh.resolve(a)).sol?.password).toBe(secret);
      const read = await get().expect(200);
      for (const data of [response.body, read.body]) {
        const serialized = JSON.stringify(data);
        for (const forbidden of [
          secret,
          'FAKE_TENANT',
          'sol_pass_encrypted',
          'cert_pass_encrypted',
          'cert_storage_url',
          'ciphertext',
          'CERT_BASE64',
        ])
          expect(serialized).not.toContain(forbidden);
      }
    });
    it('isolates two companies and keeps omitted, empty and masked secrets', async () => {
      await put({ sol_user: 'FAKE_A', sol_password: secret }).expect(200);
      for (const sol_password of [undefined, '', '********', '••••••'])
        await put({
          entorno: 'MOCK',
          ...(sol_password === undefined ? {} : { sol_password }),
        }).expect(200);
      expect((await resolver.resolve(a)).sol?.password).toBe(secret);
      expect((await resolver.resolve(b)).source).toBe('deployment');
      await put(
        { sol_user: 'FAKE_B', sol_password: 'obviously-fake-B' },
        token(b),
      ).expect(200);
      expect((await resolver.resolve(a)).sol?.password).toBe(secret);
      expect((await resolver.resolve(b)).sol?.password).toBe(
        'obviously-fake-B',
      );
    });
    it('rolls back certificate objects and company updates after PKCS#12 validation failure', async () => {
      const before = await prisma.company.findUniqueOrThrow({
        where: { id: a },
      });
      const response = await put({
        sol_user: 'FAKE',
        sol_password: secret,
        cert_base64: Buffer.from('obviously-fake-corrupt-p12').toString(
          'base64',
        ),
        cert_password: 'obviously-fake-p12-secret',
      }).expect(400);
      expect(response.text).not.toContain(secret);
      expect(response.text).not.toContain('obviously-fake-p12-secret');
      expect(await prisma.company.findUnique({ where: { id: a } })).toEqual(
        before,
      );
      expect(
        await prisma.issuerCertificate.count({ where: { company_id: a } }),
      ).toBe(0);
    });
    it('requires authentication and ADMIN, rejects company switching, RUC edits and unknown input', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices/config')
        .expect(401);
      await request(app.getHttpServer())
        .put('/api/v1/invoices/config')
        .send({})
        .expect(401);
      await put({ entorno: 'MOCK' }, token(a, 'CONTADOR')).expect(403);
      for (const body of [
        { companyId: b },
        { company_id: b },
        { ruc: '20000000000' },
        { extra: secret },
        { sol_password: 'x'.repeat(257) },
      ]) {
        const response = await put(body).expect(400);
        expect(response.text).not.toContain(secret);
      }
      expect((await resolver.resolve(a)).source).toBe('deployment');
      expect((await resolver.resolve(b)).source).toBe('deployment');
    });
    it('resets explicitly and leaves the deployment backup intact', async () => {
      await put({ sol_user: 'FAKE', sol_password: secret }).expect(200);
      await put({ action: 'reset' }).expect(200);
      expect((await resolver.resolve(a)).sol?.password).toBe(
        'obviously-fake-backup',
      );
      expect(process.env.SUNAT_SOL_PASSWORD).toBe('obviously-fake-backup');
    });
    it('rejects new encrypted writes without a valid key and fails closed on corrupted persisted data', async () => {
      const key = process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
      delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
      try {
        await put({ sol_user: 'FAKE', sol_password: secret }).expect(400);
        expect((await resolver.resolve(a)).source).toBe('deployment');
      } finally {
        process.env.ISSUER_CONFIG_ENCRYPTION_KEY = key;
      }
      await writer.save(a, { sol_user: 'FAKE', sol_password: secret });
      await prisma.company.update({
        where: { id: a },
        data: { sol_pass_encrypted: 'tampered' },
      });
      const response = await get().expect(400);
      expect(response.text).toContain('ISSUER_CONFIG_DECRYPTION_FAILED');
      expect(response.text).not.toContain(secret);
      expect(response.text).not.toContain('tampered');
    });
    it('validates and privately persists a fake PKCS#12, preserves it on omission and checks its RUC', async () => {
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: a },
      });
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date(Date.now() - 10000);
      cert.validity.notAfter = new Date(Date.now() + 86400000);
      cert.setSubject([
        { name: 'commonName', value: 'Obviously Fake Fixture ' + company.ruc },
      ]);
      cert.setIssuer(cert.subject.attributes);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      const password = 'obviously-fake-p12-password';
      const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
      const base64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
      const response = await put({
        cert_base64: base64,
        cert_password: password,
      }).expect(200);
      expect(response.body.cert_password_configurada).toBe(true);
      expect(response.text).not.toContain(base64);
      expect(response.text).not.toContain(password);
      const row = await prisma.company.findUniqueOrThrow({ where: { id: a } });
      expect(row.cert_storage_url).toMatch(/^private:/);
      const stored = await prisma.issuerCertificate.findFirstOrThrow({
        where: { company_id: a },
      });
      expect(stored.encrypted_content).not.toContain(base64);
      await put({ cert_password: '********', cert_base64: '' }).expect(200);
      expect((await resolver.resolve(a)).certificate?.base64).toBe(base64);
      await put(
        { cert_base64: base64, cert_password: password },
        token(b),
      ).expect(400);
      await put({ cert_password: 'obviously-fake-wrong-password' }).expect(400);
      expect((await resolver.resolve(a)).certificate?.password).toBe(password);
    });
    it('serializes concurrent partial updates without losing a rotated password', async () => {
      await writer.save(a, { sol_user: 'FAKE', sol_password: secret });
      await Promise.all([
        writer.save(a, { sol_password: 'obviously-fake-rotated' }),
        writer.save(a, { entorno: 'MOCK' }),
      ]);
      expect((await resolver.resolve(a)).sol?.password).toBe(
        'obviously-fake-rotated',
      );
    });
  },
);
