import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Client } from 'pg';
import { PrismaService } from '../../../src/database/prismaService';
import { customRolesEnabled, RoleCatalogService, requireAssignableRole } from '../../../src/modules/auth/application/services/roleCatalogService';
import { ModulePermissionsService } from '../../../src/modules/auth/application/services/modulePermissionsService';
import { ActionPermissionsService } from '../../../src/modules/auth/application/services/actionPermissionsService';
import { MenuPermissionsService } from '../../../src/modules/auth/application/services/menuPermissionsService';
import { SessionMembershipService } from '../../../src/modules/auth/application/services/sessionMembershipService';
import { WarehouseAccessService } from '../../../src/modules/auth/application/services/warehouseAccessService';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';
import { RefreshTokenUseCase } from '../../../src/modules/auth/application/use-cases/refreshTokenUseCase';
import { NativeCryptoHasherAdapter } from '../../../src/modules/auth/infrastructure/security/nativeCryptoHasherAdapter';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';
import { PrismaUserRepositoryAdapter } from '../../../src/modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter';
import { SYSTEM_ROLES } from '../../../src/modules/auth/domain/securityCatalog';

const rootUrl = process.env.TEST_DATABASE_URL;
const adoption = '20261118000100_roles_expansion_adoption';
const cutover = '20261118000200_roles_text_cutover';
(rootUrl ? describe : describe.skip)('Cutover: migraciones normales y cliente texto en PostgreSQL local', () => {
  jest.setTimeout(120_000);
  let admin: Client, temp: string, template: string, current: string, pg: Client, db: PrismaService;
  const clients: PrismaService[] = [];
  const originalFlag = process.env.ROLES_CUSTOM_ENABLED;
  const migrationRoot = resolve('prisma/migrations');
  function url(name: string) { const u = new URL(rootUrl!); u.pathname = '/' + name; return u.href; }
  function migrate(name: string, legacy = false) {
    return execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', ...(legacy ? ['--config', join(temp, 'prisma.config.ts')] : [])], {
      encoding: 'utf8', stdio: 'pipe', timeout: 90_000,
      env: { ...process.env, DIRECT_URL: url(name), DATABASE_URL: url(name) },
    });
  }
  function prisma(name: string) {
    const before = process.env.DATABASE_URL; process.env.DATABASE_URL = url(name);
    try { const client = new PrismaService(); clients.push(client); return client; }
    finally { if (before === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = before; }
  }
  beforeAll(async () => {
    if (!rootUrl || !['localhost', '127.0.0.1'].includes(new URL(rootUrl).hostname)) throw Error('Solo PostgreSQL local de pruebas');
    temp = mkdtempSync(join(tmpdir(), 'roles-cutover-'));
    mkdirSync(join(temp, 'migrations'));
    for (const name of readdirSync(migrationRoot)) {
      if (name !== 'migration_lock.toml' && name >= adoption) continue;
      if (name === 'migration_lock.toml') copyFileSync(join(migrationRoot, name), join(temp, 'migrations', name));
      else { mkdirSync(join(temp, 'migrations', name)); copyFileSync(join(migrationRoot, name, 'migration.sql'), join(temp, 'migrations', name, 'migration.sql')); }
    }
    symlinkSync(resolve('node_modules'), join(temp, 'node_modules'));
    writeFileSync(join(temp, 'prisma.config.ts'), `import {defineConfig} from 'prisma/config';export default defineConfig({schema:${JSON.stringify(resolve('prisma/schema'))},migrations:{path:${JSON.stringify(join(temp, 'migrations'))}},datasource:{url:process.env.DIRECT_URL}});`);
    admin = new Client({ connectionString: rootUrl }); await admin.connect();
    template = 'roles_template_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE DATABASE "${template}"`); migrate(template, true);
    const seed = new Client({ connectionString: url(template) }); await seed.connect();
    try {
      await seed.query(`INSERT INTO companies(id,ruc,legal_name,sunat_issuer_username,sunat_issuer_password_enc,updated_at) VALUES('local-company','20000000001','Empresa de prueba','local','local',now());
        INSERT INTO users(id,company_id,email,password_hash,full_name,role,updated_at) SELECT 'user-'||r,'local-company',lower(r)||'@example.invalid','hash-sintetico','Persona local',r::"Role",now() FROM unnest(ARRAY['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR']) r;
        INSERT INTO role_module_permissions(id,company_id,role,module_code,can_view,can_write,updated_at) SELECT 'm-'||role,'local-company',role,'M1',role::text<>'AUDITOR',role::text<>'CONTADOR',now() FROM users;
        INSERT INTO role_action_permissions(id,company_id,role,action_code,allowed,updated_at) SELECT 'a-'||role,'local-company',role,'INVOICE_FORCE_RESEND',role::text='OPERADOR_FACTURACION',now() FROM users;`);
      const expansion72 = readFileSync('scripts/manual/roles-administrables-expansion.sql', 'utf8').split('\n').filter(line => !line.includes('MENU_ACCOUNTING_GUIA')).join('\n').replace('<>73', '<>72').replace('*73', '*72');
      await seed.query(expansion72);
      await seed.query(`UPDATE company_roles SET name='Contabilidad vigente' WHERE code='CONTADOR';UPDATE role_menu_permissions SET can_view=false WHERE role_code='OPERADOR_FACTURACION' AND menu_code='MENU_INVOICES_FACTURAS'`);
    } finally { await seed.end(); }
  });
  beforeEach(async () => {
    delete process.env.ROLES_CUSTOM_ENABLED;
    current = 'roles_case_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE DATABASE "${current}" TEMPLATE "${template}"`);
    pg = new Client({ connectionString: url(current) }); await pg.connect(); db = prisma(current);
  });
  afterEach(async () => {
    await Promise.all(clients.splice(0).map(c => c.$disconnect())); await pg?.end();
    if (current) await admin.query(`DROP DATABASE "${current}" WITH (FORCE)`);
    if (originalFlag === undefined) delete process.env.ROLES_CUSTOM_ENABLED; else process.env.ROLES_CUSTOM_ENABLED = originalFlag;
  });
  afterAll(async () => { if (template) await admin.query(`DROP DATABASE "${template}" WITH (FORCE)`); await admin?.end(); if (temp) rmSync(temp, { recursive: true, force: true }); });
  async function snapshot() {
    const out: Record<string, unknown> = {};
    for (const table of ['users', 'role_module_permissions', 'role_action_permissions', 'company_roles', 'role_menu_permissions']) {
      const filter = table === 'role_menu_permissions' ? " WHERE menu_code<>'MENU_ACCOUNTING_GUIA'" : '';
      out[table] = (await pg.query(`SELECT md5(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text)) digest,count(*)::int n FROM (SELECT * FROM ${table}${filter}) t`)).rows[0];
    }
    return out;
  }
  async function effective() {
    const modules = new ModulePermissionsService(db), actions = new ActionPermissionsService(db), menus = new MenuPermissionsService(db);
    return Promise.all(SYSTEM_ROLES.map(async role => {
      const m = await modules.forRole('local-company', role);
      return { role, modules: m, actions: await actions.forRole('local-company', role), menus: await menus.forRole('local-company', role, m) };
    }));
  }
  async function authRoundTrips() {
    const tokens = new NativeJwtAdapter({ get: () => 'roles-cutover-local-jwt-secret-32-characters' } as never);
    const repository = new PrismaUserRepositoryAdapter(db), membership = new SessionMembershipService(db);
    const login = new LoginUseCase(repository, new NativeCryptoHasherAdapter(), tokens, membership);
    const refresh = new RefreshTokenUseCase(repository, tokens, membership);
    const results = [];
    for (const role of SYSTEM_ROLES) {
      const response = await login.execute({ email: role.toLowerCase() + '@example.invalid', password: 'LocalPassword123!' });
      expect(response.user.role).toBe(role);
      expect(tokens.verifyToken(response.accessToken)).toMatchObject({ role, companyId: 'local-company', sub: 'user-' + role });
      const renewed = await refresh.execute(response.refreshToken);
      expect(tokens.verifyToken(renewed.accessToken)).toMatchObject({ role, companyId: 'local-company', sub: 'user-' + role });
      results.push({ role, user: response.user.role, refreshed: tokens.verifyToken(renewed.accessToken)?.role, refreshToken: renewed.refreshToken });
    }
    return results;
  }
  async function assertJournal() {
    const rows = (await pg.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations')).rows;
    expect(rows).toHaveLength(readdirSync(migrationRoot).filter(n => n !== 'migration_lock.toml').length);
    for (const row of rows) {
      expect(row.finished_at).not.toBeNull(); expect(row.rolled_back_at).toBeNull();
      expect(row.checksum).toBe(createHash('sha256').update(readFileSync(join(migrationRoot, row.migration_name, 'migration.sql'))).digest('hex'));
    }
  }
  it('preserva snapshots de cinco roles/overrides y datos; solo añade guía y cinco permisos', async () => {
    await db.user.updateMany({ data: { password_hash: await new NativeCryptoHasherAdapter().hash('LocalPassword123!') } });
    const before = await snapshot(), rights = await effective(), auth = await authRoundTrips();
    expect(await customRolesEnabled(db)).toBe(false);
    process.env.ROLES_CUSTOM_ENABLED = 'true'; expect(await customRolesEnabled(db)).toBe(false);
    delete process.env.ROLES_CUSTOM_ENABLED;
    const indexes = (await pg.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN('users','role_module_permissions','role_action_permissions') ORDER BY indexname")).rows;
    migrate(current);
    expect(await snapshot()).toEqual(before); expect(await effective()).toEqual(rights); expect((await authRoundTrips()).map(({ role, user, refreshed }) => ({ role, user, refreshed }))).toEqual(auth.map(({ role, user, refreshed }) => ({ role, user, refreshed })));
    const preservedTokens = new NativeJwtAdapter({ get: () => 'roles-cutover-local-jwt-secret-32-characters' } as never);
    const preservedRefresh = new RefreshTokenUseCase(new PrismaUserRepositoryAdapter(db), preservedTokens, new SessionMembershipService(db));
    for (const session of auth) expect(preservedTokens.verifyToken((await preservedRefresh.execute(session.refreshToken)).accessToken)?.role).toBe(session.role);
    expect(await customRolesEnabled(db)).toBe(false);
    expect((await pg.query('SELECT count(*)::int n FROM permission_menu_catalog')).rows[0].n).toBe(73);
    expect((await pg.query('SELECT count(*)::int n FROM role_menu_permissions')).rows[0].n).toBe(365);
    expect((await pg.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN('users','role_module_permissions','role_action_permissions') ORDER BY indexname")).rows).toEqual(indexes);
    await assertJournal(); expect(migrate(current)).toContain('No pending migrations');
    await expect(pg.query("UPDATE users SET role='AJENO' WHERE id='user-AUDITOR'")).rejects.toMatchObject({ code: '23503' });
  });
  it('adopta 73 menús ya existentes sin sobrescribir una denegación en guía', async () => {
    await pg.query("INSERT INTO permission_menu_catalog VALUES('MENU_ACCOUNTING_GUIA','M4','/accounting/guia','MENU_ACCOUNTING');INSERT INTO role_menu_permissions SELECT company_id,code,'MENU_ACCOUNTING_GUIA',false FROM company_roles");
    const before = (await pg.query('SELECT * FROM role_menu_permissions ORDER BY company_id,role_code,menu_code')).rows;
    migrate(current); expect((await pg.query('SELECT * FROM role_menu_permissions ORDER BY company_id,role_code,menu_code')).rows).toEqual(before);
  });
  it('reproduce todas las migraciones desde cero y usa el cliente texto para una empresa nueva', async () => {
    await db.$disconnect(); await pg.end(); await admin.query(`DROP DATABASE "${current}"`); await admin.query(`CREATE DATABASE "${current}"`);
    migrate(current); pg = new Client({ connectionString: url(current) }); await pg.connect(); db = prisma(current);
    await assertJournal(); expect((await pg.query('SELECT count(*)::int n FROM permission_menu_catalog')).rows[0].n).toBe(73);
    const { initializeCompanyRoles } = await import('../../../src/modules/auth/application/services/roleCatalogService');
    await db.$transaction(async tx => { await tx.company.create({ data: { id: 'new-company', ruc: '20000000002', legal_name: 'Nueva local', sunat_issuer_username: 'local', sunat_issuer_password_enc: 'local' } }); await initializeCompanyRoles(tx, 'new-company'); await tx.user.create({ data: { company_id: 'new-company', email: 'nuevo@example.invalid', full_name: 'Nuevo', password_hash: 'hash', role: 'ADMIN' } }); });
    expect(await db.companyRole.count({ where: { company_id: 'new-company' } })).toBe(5);
  });
  it.each([
    ['parcial', 'ALTER TABLE role_menu_permissions RENAME TO missing_matrix'],
    ['forma', 'ALTER TABLE company_roles ADD COLUMN extra_local text'],
    ['catálogo', "UPDATE permission_menu_catalog SET module_code='M10' WHERE menu_code='MENU_INVOICES_FACTURAS'"],
    ['huérfano', "DELETE FROM role_menu_permissions WHERE role_code='AUDITOR';DELETE FROM company_roles WHERE code='AUDITOR'"],
  ])('aborta adopción %s sin convertir columnas y conserva evidencia de fallo', async (_label, alteration) => {
    await pg.query(alteration);
    expect(() => migrate(current)).toThrow();
    expect((await pg.query("SELECT count(*)::int n FROM pg_attribute WHERE attrelid IN('users'::regclass,'role_module_permissions'::regclass,'role_action_permissions'::regclass) AND attname='role' AND atttypid='\"Role\"'::regtype")).rows[0].n).toBe(3);
    expect((await pg.query('SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL')).rows[0].n).toBe(1);
    expect(() => migrate(current)).toThrow();
  });
  it('un fallo al final de la conversión revierte DDL/datos y permite migrate deploy posterior', async () => {
    await pg.query(readFileSync(join(migrationRoot, adoption, 'migration.sql'), 'utf8'));
    const before = await snapshot();
    const interrupted = readFileSync(join(migrationRoot, cutover, 'migration.sql'), 'utf8').replace(/COMMIT;\s*$/, "DO $failure$ BEGIN RAISE EXCEPTION 'Fallo local antes de COMMIT'; END $failure$; COMMIT;");
    await expect(pg.query(interrupted)).rejects.toThrow('Fallo local antes de COMMIT');
    await pg.query('ROLLBACK'); expect(await snapshot()).toEqual(before);
    expect((await pg.query("SELECT format_type(atttypid,atttypmod) storage FROM pg_attribute WHERE attrelid='users'::regclass AND attname='role'")).rows[0].storage).toBe('"Role"');
    migrate(current); await assertJournal();
  });
  it('un enum distinto aborta la segunda migración sin convertir ni alterar usuarios', async () => {
    const before = await snapshot(); await pg.query('ALTER TYPE "Role" ADD VALUE \'EXTRA_LOCAL\'');
    expect(() => migrate(current)).toThrow(); expect(await snapshot()).toEqual(before);
    const failed = (await pg.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL')).rows;
    expect(failed).toEqual([{ migration_name: cutover }]);
  });
  it('un lector retenido produce lock_timeout sin una conversión parcial', async () => {
    const blocker = new Client({ connectionString: url(current) }); await blocker.connect();
    const before = await snapshot();
    try {
      await blocker.query('BEGIN; LOCK TABLE users IN ACCESS SHARE MODE');
      expect(() => migrate(current)).toThrow();
    } finally { await blocker.query('ROLLBACK'); await blocker.end(); }
    expect(await snapshot()).toEqual(before);
    expect((await pg.query("SELECT format_type(atttypid,atttypmod) storage FROM pg_attribute WHERE attrelid='users'::regclass AND attname='role'")).rows[0].storage).toBe('"Role"');
  });
  it('crea/asigna un rol propio sin permisos y concede explícitamente con cliente texto real', async () => {
    migrate(current);
    const catalog = new RoleCatalogService(db), users = new WarehouseAccessService(db), modules = new ModulePermissionsService(db), actions = new ActionPermissionsService(db), menus = new MenuPermissionsService(db);
    await expect(catalog.create('local-company', 'PROPIO', 'Administrador', 'user-ADMIN')).rejects.toMatchObject({ status: 403 });
    process.env.ROLES_CUSTOM_ENABLED = 'true'; expect(await customRolesEnabled(db)).toBe(true);
    await catalog.create('local-company', 'PROPIO', 'Administrador', 'user-ADMIN');
    await users.updateUser('local-company', 'user-AUDITOR', 'user-ADMIN', { role: 'PROPIO' });
    const session = await new SessionMembershipService(db).resolve({ sub: 'user-AUDITOR', companyId: 'local-company', email: 'old@example.invalid', role: 'ADMIN' });
    expect(session.role).toBe('PROPIO');
    expect((await modules.forRole('local-company', 'PROPIO')).every(m => !m.canView && !m.canWrite)).toBe(true);
    expect((await actions.forRole('local-company', 'PROPIO')).every(a => !a.allowed)).toBe(true);
    expect((await menus.forRole('local-company', 'PROPIO', await modules.forRole('local-company', 'PROPIO'))).every(m => !m.canView)).toBe(true);
    await modules.replace('local-company', [{ role: 'PROPIO', moduleCode: 'M1', canView: true, canWrite: true }], 'user-ADMIN');
    await menus.replace('local-company', [{ role: 'PROPIO', menuCode: 'MENU_INVOICES_FACTURAS', canView: true }], 'user-ADMIN');
    await actions.replace('local-company', [{ role: 'PROPIO', actionCode: 'INVOICE_EMIT', allowed: true }, { role: 'PROPIO', actionCode: 'INVOICE_CONFIG_EDIT', allowed: true }], 'user-ADMIN');
    await expect(actions.assertAllowed('local-company', 'PROPIO', 'INVOICE_EMIT')).resolves.toBeUndefined();
    await expect(actions.assertAllowed('local-company', 'PROPIO', 'INVOICE_CONFIG_EDIT')).rejects.toMatchObject({ status: 403 });
    expect((await menus.forRole('local-company', 'PROPIO', await modules.forRole('local-company', 'PROPIO'))).find(m => m.path === '/invoices/facturas')?.canView).toBe(true);
    await expect(users.updateUser('local-company', 'user-ADMIN', 'user-ADMIN', { role: 'PROPIO' })).rejects.toMatchObject({ status: 400 });
    await expect(catalog.rename('local-company', 'ADMIN', 'Otro', 'user-ADMIN')).rejects.toMatchObject({ status: 403 });
    expect(await db.auditLog.count({ where: { company_id: 'local-company', module: 'M0_AUTH' } })).toBeGreaterThanOrEqual(5);
    delete process.env.ROLES_CUSTOM_ENABLED; expect(await customRolesEnabled(db)).toBe(false);
    await expect(requireAssignableRole(db, 'local-company', 'PROPIO')).rejects.toMatchObject({ status: 403 });
  });
  it.each([
    ['FK ausente', 'ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey'],
    ['sin validar', 'ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey;ALTER TABLE users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES company_roles(company_id,code) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID'],
    ['orden invertido', 'ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey;ALTER TABLE users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(role,company_id) REFERENCES company_roles(code,company_id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['origen incorrecto', 'DELETE FROM users;ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey;ALTER TABLE users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(company_id,email) REFERENCES company_roles(company_id,code) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['destino incorrecto', 'DELETE FROM users;ALTER TABLE company_roles ADD UNIQUE(company_id,name);ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey;ALTER TABLE users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES company_roles(company_id,name) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['acción incorrecta', 'ALTER TABLE users DROP CONSTRAINT users_company_id_role_fkey;ALTER TABLE users ADD CONSTRAINT users_company_id_role_fkey FOREIGN KEY(company_id,role) REFERENCES company_roles(company_id,code) ON UPDATE CASCADE ON DELETE RESTRICT'],
    ['diferible', 'ALTER TABLE users ALTER CONSTRAINT users_company_id_role_fkey DEFERRABLE'],
    ['nullable', 'ALTER TABLE users ALTER COLUMN role DROP NOT NULL'],
    ['tipo distinto', 'ALTER TABLE users ALTER COLUMN role TYPE varchar USING role::varchar'],
  ])('compuerta cerrada con %s aunque hay dos columnas en una FK', async (_label, alteration) => {
    migrate(current); process.env.ROLES_CUSTOM_ENABLED = 'true'; expect(await customRolesEnabled(db)).toBe(true);
    await pg.query(alteration); expect(await customRolesEnabled(db)).toBe(false);
  });
});
