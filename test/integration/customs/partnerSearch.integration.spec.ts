import { Client } from 'pg';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';
import type { PrismaService } from '../../../src/database/prismaService';
import type { Prisma } from '../../../src/generated/client/client';

// Base local desechable. La tabla temporal aísla estas pruebas de cualquier dato.
const databaseUrl = process.env.M1_PARTNER_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)('B4 búsqueda de terceros en PostgreSQL', () => {
  let client: Client;
  let service: MasterDataService;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`CREATE TEMP TABLE business_partners (
      id text, company_id text, roles text[], legal_name text,
      doc_number text, trade_name text
    )`);
    const rows = [
      ['target', 'emp-1', ['CLIENTE'], 'Ferretería Águila', '201234', 'Útiles'],
      ['foreign', 'emp-2', ['CLIENTE'], 'Ferretería ajena', '201235', null],
      ['supplier', 'emp-1', ['PROVEEDOR'], 'Ferretería proveedora', '201236', null],
      ['decomposed', 'emp-1', ['CLIENTE'], 'Cafe\u0301 Central', '201237', null],
      ['literal', 'emp-1', ['CLIENTE'], "100%_ ' OR true --", '201238', null],
    ];
    for (const row of rows) {
      await client.query('INSERT INTO business_partners VALUES ($1,$2,$3,$4,$5,$6)', row);
    }
    await client.query(`INSERT INTO business_partners
      SELECT 'bulk-' || n, 'emp-1', ARRAY['CLIENTE'], 'AAA ' || n, n::text, NULL
      FROM generate_series(1, 205) n`);
    service = new MasterDataService({
      $queryRaw: async (query: Prisma.Sql) => (await client.query(query.text, query.values)).rows,
    } as unknown as PrismaService);
  });

  afterAll(async () => { await client?.end(); });

  it.each(['ferreteria', 'FERRETERÍA', 'fErReTeRiA', '  ferreteria  '])(
    '%s encuentra nombres con tildes sin perder empresa ni rol', async (term) => {
      const rows = await service.listPartners('emp-1', 'cliente', term);
      expect(rows.map((row) => row.id)).toEqual(['target']);
    },
  );

  it('busca nombre comercial, documento y Unicode descompuesto', async () => {
    for (const [term, id] of [['utiles', 'target'], ['201234', 'target'], ['CAFÉ', 'decomposed']]) {
      expect((await service.listPartners('emp-1', undefined, term)).map((r) => r.id)).toEqual([id]);
    }
  });

  it('filtra antes del límite y conserva orden y máximo 200', async () => {
    expect((await service.listPartners('emp-1', 'CLIENTE', 'aguila')).map((r) => r.id)).toEqual(['target']);
    const rows = await service.listPartners('emp-1', 'CLIENTE', 'aaa');
    expect(rows).toHaveLength(200);
    expect(rows[0].legal_name).toBe('AAA 1');
    expect(rows.every((r) => r.company_id === 'emp-1')).toBe(true);
  });

  it('trata comodines y SQL como texto literal', async () => {
    expect((await service.listPartners('emp-1', undefined, "%_ ' OR true --")).map((r) => r.id)).toEqual(['literal']);
    expect(await service.listPartners('emp-1', undefined, 'inexistente')).toEqual([]);
  });
});
