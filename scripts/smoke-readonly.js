/**
 * Smoke test de solo lectura contra Supabase/PostgreSQL.
 * No crea, actualiza ni elimina registros.
 */
require('dotenv/config');
const { Client } = require('pg');

const tablas = ['companies', 'invoices', 'accounting_entries', 'accounting_lines', 'accounting_rules', 'accounting_periods', 'accounting_fiscal_years', 'collections', 'expenses', 'national_purchases', 'inventory_products', 'inventory_balances', 'company_treasury_accounts', 'expense_distributions', 'collection_distributions'];
const columnas = [['accounting_entries', 'journal_code'], ['invoices', 'detraccion_deposited_at'], ['invoices', 'detraccion_constancia'], ['invoices', 'detraccion_deposited_amount'], ['collections', 'invoice_id'], ['expenses', 'paid_amount'], ['accounting_entries', 'idempotency_key'], ['company_treasury_accounts', 'kind'], ['expense_distributions', 'percentage'], ['collection_distributions', 'percentage']];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const fallos = [];
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('Conexión PostgreSQL: OK');

    for (const t of tablas) {
      const r = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${t}`]);
      if (!r.rows[0]?.exists) fallos.push(`Falta la tabla ${t}`);
    }
    for (const [t, c] of columnas) {
      const r = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS exists", [t, c]);
      if (!r.rows[0]?.exists) fallos.push(`Falta la columna ${t}.${c}`);
    }

    const counts = {};
    for (const t of ['companies', 'accounting_rules', 'accounting_entries', 'invoices', 'collections', 'expenses', 'national_purchases']) {
      counts[t] = Number((await client.query(`SELECT count(*) FROM ${t}`)).rows[0].count);
    }
    console.log('Conteos:', counts);

    if (fallos.length) {
      console.error('\nSMOKE FAIL');
      fallos.forEach((f) => console.error('-', f));
      process.exitCode = 1;
      return;
    }
    console.log('\nSMOKE OK: esquema y conexión verificados en solo lectura.');
  } catch (error) {
    console.error('SMOKE FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
