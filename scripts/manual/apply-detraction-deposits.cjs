/** Aplicación de una sola migración revisada. Nunca ejecuta migrate deploy ni lee .env. */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const name = '20261116100000_invoice_detraction_deposits';
const directory = resolve(__dirname, '../../prisma/migrations', name);
const sql = readFileSync(resolve(directory, 'migration.sql'), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const expected = readFileSync(resolve(__dirname, 'detraction-deposits.sha256'), 'utf8').trim().split(/\s/)[0];
async function verify(client) {
 const mismatch = await client.query(`WITH sums AS (
 SELECT company_id, invoice_id, SUM(amount) amount FROM invoice_detraction_deposits GROUP BY company_id, invoice_id
 ), latest AS (SELECT DISTINCT ON (company_id, invoice_id) company_id, invoice_id, date, constancia
 FROM invoice_detraction_deposits ORDER BY company_id, invoice_id, date DESC, created_at DESC, id DESC)
 SELECT i.id FROM invoices i LEFT JOIN sums s ON s.invoice_id=i.id AND s.company_id=i.company_id
 LEFT JOIN latest l ON l.invoice_id=i.id AND l.company_id=i.company_id
 WHERE i.detraccion_deposited_amount IS DISTINCT FROM s.amount
 OR i.detraccion_deposited_at IS DISTINCT FROM l.date OR i.detraccion_constancia IS DISTINCT FROM l.constancia
 OR COALESCE(s.amount,0) > COALESCE((i.payload_ubl->>'montoDetraccion')::numeric,0) LIMIT 1`);
 if (mismatch.rowCount) throw new Error('La verificación del resumen o del límite acumulado falló. Se revierte la aplicación.');
 const index = await client.query("SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='invoice_detraction_deposits' AND indexname='invoice_detraction_deposits_company_id_invoice_id_date_idx'");
 if (!index.rowCount) throw new Error('Falta el índice de movimientos por empresa/factura/fecha.');
 const constraints = await client.query(`SELECT conname FROM pg_constraint WHERE conrelid='invoice_detraction_deposits'::regclass AND convalidated`);
 for (const required of ['invoice_detraction_deposits_pkey','invoice_detraction_deposits_invoice_fkey','invoice_detraction_deposits_amount_check','invoice_detraction_deposits_constancia_check']) {
  if (!constraints.rows.some(r => r.conname === required)) throw new Error(`Falta restricción validada: ${required}`);
 }
}
async function main() {
 if (checksum !== expected) throw new Error('Checksum SQL distinto al revisado.');
 const mode = process.argv[2] || '--check';
 if (!['--check','--apply'].includes(mode)) throw new Error('Use --check (solo lectura) o --apply (aplicación explícita).');
 if (!process.env.MANUAL_DATABASE_URL) throw new Error('Defina MANUAL_DATABASE_URL explícitamente; no se utiliza DATABASE_URL ni .env.');
 const client = new Client({ connectionString: process.env.MANUAL_DATABASE_URL });
 await client.connect();
 try {
  await client.query(mode === '--apply' ? 'BEGIN' : 'BEGIN READ ONLY');
  if (mode === '--apply') {
   await client.query("SELECT pg_advisory_xact_lock(hashtext('manual:invoice-detraction-deposits'))");
   await client.query('LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE');
  }
  const unfinished = await client.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL');
  if (unfinished.rowCount) throw new Error('Existen migraciones sin finalizar; revisar antes de aplicar.');
  const applied = await client.query('SELECT checksum FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL', [name]);
  if (applied.rowCount) {
   if (applied.rowCount !== 1 || applied.rows[0].checksum !== checksum) throw new Error('El registro previo no coincide con el checksum esperado.');
   await verify(client);
   console.log(`Migración ya aplicada y verificada: ${name}; SHA-256 ${checksum}`);
  } else {
   const table = await client.query("SELECT to_regclass('public.invoice_detraction_deposits') AS name");
   if (table.rows[0].name) throw new Error('La tabla existe sin registro de esta migración; no se marca automáticamente como aplicada.');
   // Verifica los datos y las columnas/JSON reales sin ejecutar DDL.
   const invalid = await client.query(`SELECT id FROM invoices WHERE
    (detraccion_deposited_at IS NOT NULL OR detraccion_deposited_amount IS NOT NULL OR detraccion_constancia IS NOT NULL)
    AND (detraccion_deposited_at IS NULL OR detraccion_deposited_amount IS NULL OR detraccion_deposited_amount <= 0
    OR COALESCE((payload_ubl->>'montoDetraccion')::numeric,0) < detraccion_deposited_amount) LIMIT 1`);
   if (invalid.rowCount) throw new Error('Hay depósitos históricos incompletos o superiores a la detracción. No se aplica el cambio.');
   if (mode === '--apply') {
    await client.query(sql);
    await verify(client);
    await client.query(`INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,now(),$3,now(),1)`, [randomUUID(),checksum,name]);
    console.log(`Migración aplicada y verificada: ${name}; SHA-256 ${checksum}`);
   } else console.log(`Verificaciones previas OK. Sin cambios. SQL SHA-256 ${checksum}`);
  }
  await client.query('COMMIT');
 } catch (error) { await client.query('ROLLBACK'); throw error; }
 finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
