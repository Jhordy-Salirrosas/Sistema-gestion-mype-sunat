/**
 * Pruebas de concurrencia y rollback del Transactional Outbox (TA-13).
 *
 * A diferencia de las pruebas unitarias del repositorio, estas usan PostgreSQL
 * REAL: el patron Outbox existe para garantizar atomicidad en la base de datos,
 * y con mocks esa garantia no se puede demostrar.
 *
 * Requiere una base con las migraciones aplicadas:
 *
 *   docker run -d --name postgres-ta19 -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=ta13_test -p 5435:5432 postgres:16
 *   $env:DIRECT_URL="postgresql://postgres:test@localhost:5435/ta13_test"
 *   npx prisma migrate deploy
 *
 * O definir TEST_DATABASE_URL con otra cadena.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request = require('supertest');

import { AppModule } from '../../../src/appModule';
import { PrismaService } from '../../../src/database/prismaService';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { PrismaInvoiceRepository } from '../../../src/modules/invoices/infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceEntity } from '../../../src/modules/invoices/domain/entities/invoiceEntity';
import {
  INVOICE_QUEUE,
  QueueService,
} from '../../../src/modules/resilience/infrastructure/queue/queue.service';

/** Base de datos de pruebas. test/setup.ts apunta DATABASE_URL a un valor falso. */
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:test@localhost:5435/ta13_test';

/** RUC valido (Modulo 11): el DTO lo valida con @IsRucValid. */
const RUC = '20123456786';

/** Series exclusivas de estas pruebas, para aislar los datos y poder limpiarlos. */
const SERIE_ROLLBACK = 'T901';
const SERIE_CONCURRENCIA = 'T902';
const SERIE_ENDPOINT = 'T903';

/** El patron tarda: pg-boss crea su esquema en la primera ejecucion. */
jest.setTimeout(60_000);

describe('Transactional Outbox: rollback y concurrencia (TA-13)', () => {
  let prisma: PrismaService;
  let queue: QueueService | null = null;
  let companyId: string;
  let accessToken: string;

  function crearEntidad(serie: string, correlativo: number): InvoiceEntity {
    return new InvoiceEntity({
      company_id: companyId,
      ruc_emisor: RUC,
      serie,
      correlativo,
      tipo_comprobante: '01',
      monto_total: 118,
      fecha_emision: new Date(),
      payload_ubl: { test: 'ta-13' },
    });
  }

  beforeAll(async () => {
    // Debe fijarse ANTES de construir PrismaService y QueueService: ambos leen
    // DATABASE_URL en el constructor.
    process.env.DATABASE_URL = TEST_DB_URL;

    prisma = new PrismaService();

    try {
      await prisma.$connect();
    } catch {
      throw new Error(
        `TA-13 necesita PostgreSQL en ${TEST_DB_URL}.\n` +
          'Levantá el contenedor y aplicá las migraciones (ver prisma/README.md).',
      );
    }

    // Empresa de pruebas: invoices.company_id es FK a companies.
    const company = await prisma.company.create({
      data: {
        ruc: RUC,
        legal_name: 'EMPRESA DE PRUEBA TA-13 S.A.C.',
        sol_user: 'MODDATOS',
        sol_pass_encrypted: 'cifrado-de-prueba',
      },
    });
    companyId = company.id;

    // Token real firmado con el mismo adaptador que usa la aplicacion.
    // Sin JWT_SECRET en el entorno, el adaptador usa su secreto de desarrollo,
    // el mismo que usara AppModule al verificar.
    const tokenService = new NativeJwtAdapter({
      get: () => undefined,
    } as unknown as ConfigService);

    accessToken = tokenService.signToken({
      sub: 'user-ta-13',
      email: 'ta13@mype.pe',
      companyId,
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    if (queue) {
      await queue.onModuleDestroy();
    }

    // Limpieza: primero los comprobantes (FK), despues la empresa.
    if (prisma && companyId) {
      await prisma.invoice.deleteMany({ where: { company_id: companyId } });
      await prisma.company
        .delete({ where: { id: companyId } })
        .catch(() => undefined);
    }

    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    // Limpieza previa: los tests pueden repetirse sobre la misma base.
    await prisma.invoice.deleteMany({
      where: {
        serie: { in: [SERIE_ROLLBACK, SERIE_CONCURRENCIA, SERIE_ENDPOINT] },
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Criterio 1: rollback
  // ---------------------------------------------------------------------------
  it('revierte la transacción: si el encolado falla, la fila Invoice no persiste', async () => {
    // Solo se mockea el encolado. Prisma es REAL, así que la transacción y su
    // rollback los ejecuta PostgreSQL.
    const queueQueFalla = {
      enqueueInvoiceInTx: jest
        .fn()
        .mockRejectedValue(
          new Error('fallo inyectado en el encolado del outbox'),
        ),
    } as unknown as QueueService;

    const repository = new PrismaInvoiceRepository(prisma, queueQueFalla);

    await expect(
      repository.saveWithTransactionalOutbox(crearEntidad(SERIE_ROLLBACK, 1)),
    ).rejects.toThrow();

    const persistidas = await prisma.invoice.count({
      where: { serie: SERIE_ROLLBACK },
    });

    // El INSERT se ejecutó dentro de la transacción y fue revertido: no queda fila.
    expect(persistidas).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Criterio 2: concurrencia
  // ---------------------------------------------------------------------------
  it('10 envíos simultáneos generan 10 filas y 10 jobs, sin duplicados', async () => {
    // QueueService REAL: pg-boss crea su esquema y las colas en onModuleInit.
    queue = new QueueService();
    await queue.onModuleInit();

    const repository = new PrismaInvoiceRepository(prisma, queue);

    const entidades = Array.from({ length: 10 }, (_, i) =>
      crearEntidad(SERIE_CONCURRENCIA, i + 1),
    );

    const resultados = await Promise.all(
      entidades.map((entidad) =>
        repository.saveWithTransactionalOutbox(entidad),
      ),
    );

    // 10 resultados, con identificadores distintos.
    expect(resultados).toHaveLength(10);
    const ids = resultados.map((r) => r.id);
    expect(new Set(ids).size).toBe(10);

    // 10 filas en la tabla de comprobantes.
    const filas = await prisma.invoice.count({
      where: { serie: SERIE_CONCURRENCIA },
    });
    expect(filas).toBe(10);

    // 10 jobs en la cola, uno por comprobante, sin duplicados.
    const jobs = await prisma.$queryRawUnsafe<
      { total: bigint; distintos: bigint }[]
    >(
      `SELECT count(*) AS total,
              count(DISTINCT data->>'invoice_id') AS distintos
         FROM pgboss.job
        WHERE name = $1
          AND data->>'invoice_id' = ANY($2::text[])`,
      INVOICE_QUEUE,
      ids,
    );

    expect(Number(jobs[0].total)).toBe(10);
    expect(Number(jobs[0].distintos)).toBe(10);
  });

  // ---------------------------------------------------------------------------
  // Criterio 3: no bloqueo
  // ---------------------------------------------------------------------------
  it('con el Mock de SUNAT caído, 10 facturas responden 202 en menos de 500 ms', async () => {
    // SUNAT inalcanzable: el endpoint de ingesta no debe depender de ella.
    process.env.SUNAT_BILL_SERVICE_URL = 'http://127.0.0.1:1/';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    try {
      const servidor = app.getHttpServer();

      const mediciones = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const inicio = Date.now();
          const respuesta = await request(servidor)
            .post('/api/v1/invoices')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              ruc_emisor: RUC,
              serie: SERIE_ENDPOINT,
              correlativo: i + 1,
              tipo_comprobante: '01',
              monto_total: 118,
              fecha_emision: new Date().toISOString(),
              payload_ubl: { test: 'ta-13' },
            });
          return { status: respuesta.status, ms: Date.now() - inicio };
        }),
      );

      mediciones.forEach((m) => expect(m.status).toBe(202));
      mediciones.forEach((m) => expect(m.ms).toBeLessThan(500));

      // Y todas quedaron asociadas a la empresa del token.
      const asociadas = await prisma.invoice.count({
        where: { serie: SERIE_ENDPOINT, company_id: companyId },
      });
      expect(asociadas).toBe(10);
    } finally {
      await app.close();
    }
  });
});
