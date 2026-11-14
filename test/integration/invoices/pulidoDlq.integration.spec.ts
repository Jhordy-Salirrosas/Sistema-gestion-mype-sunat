import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService, INVOICE_DLQ, INVOICE_QUEUE } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import type { PgBoss } from 'pg-boss';

const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('5C DLQ → principal real, sin consumidor ni transporte SUNAT', () => {
  let prisma: PrismaService; let queue: QueueService; let boss: PgBoss; let companyId: string; let invoiceId: string;
  const originalDb = process.env.DATABASE_URL; const originalBoss = process.env.PG_BOSS_URL;
  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl; process.env.PG_BOSS_URL = dbUrl;
    prisma = new PrismaService(); await prisma.$connect(); queue = new QueueService(); await queue.onModuleInit();
    boss = (queue as unknown as { boss: PgBoss }).boss;
    companyId = (await prisma.company.create({ data: { ruc: `20${Date.now().toString().slice(-9)}`, legal_name: 'Prueba DLQ M1', sol_user: 'MODDATOS', sol_pass_encrypted: 'prueba-local', } })).id;
    invoiceId = randomUUID();
    await prisma.invoice.create({ data: { id: invoiceId, company_id: companyId, ruc_emisor: '20614142503', tipo_comprobante: '01', serie: 'F001', correlativo: 57,
      monto_total: 118, fecha_emision: new Date('2026-11-10'), estado: 'EN_COLA', payload_ubl: {}, transport_uncertain: null } });
  }, 30000);
  afterAll(async () => {
    if (boss && invoiceId) for (const name of [INVOICE_QUEUE, INVOICE_DLQ]) {
      const jobs = await boss.findJobs(name, { data: { invoice_id: invoiceId } }); if (jobs.length) await boss.deleteJob(name, jobs.map(j => j.id));
    }
    if (prisma && companyId) {
      await prisma.transactionHistory.deleteMany({ where: { company_id: companyId } });
      await prisma.invoice.deleteMany({ where: { company_id: companyId } }); await prisma.company.delete({ where: { id: companyId } });
    }
    if (queue) await queue.onModuleDestroy(); if (prisma) await prisma.$disconnect();
    process.env.DATABASE_URL = originalDb; if (originalBoss === undefined) delete process.env.PG_BOSS_URL; else process.env.PG_BOSS_URL = originalBoss;
  }, 30000);
  it('rescata F001-57 una vez y persiste incertidumbre antes de publicar; aceptadas permanecen protegidas', async () => {
    await boss.send(INVOICE_DLQ, { invoice_id: invoiceId, company_id: companyId }, { retryLimit: 0 });
    const originalSend = boss.send.bind(boss);
    const publicar = jest.spyOn(boss, 'send').mockImplementation(async (...args: any[]) => {
      if (args[0] === INVOICE_QUEUE) expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).transport_uncertain).toBe(true);
      return (originalSend as any)(...args);
    });
    try {
      const service = new InvoiceQueryService(prisma, queue);
      expect(await service.reintentarCdr(companyId, invoiceId)).toMatchObject({ encolado: true, resultadoCola: 'ENCOLADO' });
      expect(await boss.findJobs(INVOICE_DLQ, { data: { invoice_id: invoiceId }, queued: true })).toHaveLength(0);
      expect(await boss.findJobs(INVOICE_QUEUE, { data: { invoice_id: invoiceId }, queued: true })).toHaveLength(1);
      expect(await service.reintentarCdr(companyId, invoiceId)).toMatchObject({ encolado: false, resultadoCola: 'YA_EN_COLA' });
      expect(publicar).toHaveBeenCalledTimes(1);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).transport_uncertain).toBe(true);
      expect(await boss.findJobs(INVOICE_QUEUE, { data: { invoice_id: invoiceId }, queued: true })).toHaveLength(1);
      await prisma.invoice.update({ where: { id: invoiceId }, data: { estado: 'ACEPTADO' } });
      expect(await service.reintentarCdr(companyId, invoiceId)).toMatchObject({ encolado: false });
      expect(publicar).toHaveBeenCalledTimes(1);
    } finally { publicar.mockRestore(); }
  }, 20000);
});
