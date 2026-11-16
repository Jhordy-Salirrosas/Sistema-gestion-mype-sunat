/**
 * Diagnóstico de solo lectura de la base de producción.
 * No modifica nada: solo consulta el estado del catálogo y la configuración.
 */
const { Client } = require('pg');

const url = process.env.URL_DIAGNOSTICO;
if (!url) {
  console.error('Falta URL_DIAGNOSTICO');
  process.exit(1);
}

const consultas = [
  ['tablas nuevas', `
    SELECT 'company_treasury_accounts' AS objeto, to_regclass('public.company_treasury_accounts') IS NOT NULL AS existe
    UNION ALL SELECT 'expense_distributions', to_regclass('public.expense_distributions') IS NOT NULL
    UNION ALL SELECT 'collection_distributions', to_regclass('public.collection_distributions') IS NOT NULL
    UNION ALL SELECT 'idx entries por origen', to_regclass('public.accounting_entries_company_id_source_module_source_reference_id_idx') IS NOT NULL
    UNION ALL SELECT 'idx collections por factura', to_regclass('public.collections_company_id_invoice_id_idx') IS NOT NULL`],
  ['migraciones registradas', `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 6`],
  ['empresas con RUC', `SELECT ruc, legal_name FROM companies ORDER BY created_at LIMIT 10`],
  ['reglas en cuentas de mayor', `
    SELECT process_code, line_order, account_code
    FROM accounting_rules
    WHERE is_active = true AND account_code IN ('611','759','74','659')
    ORDER BY process_code, line_order`],
  ['cuentas base', `SELECT count(*) AS total FROM accounting_accounts`],
  ['subcuentas de caja', `SELECT code, name FROM accounting_accounts WHERE code IN ('1011','1012','1013','1041','1043') ORDER BY code`],
];

(async () => {
  const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await cliente.connect();
    console.log('conexion: OK');
    for (const [titulo, sql] of consultas) {
      try {
        const r = await cliente.query(sql);
        console.log(`\n### ${titulo}`);
        if (r.rows.length === 0) console.log('  (sin filas)');
        for (const fila of r.rows) console.log('  ' + JSON.stringify(fila));
      } catch (error) {
        console.log(`\n### ${titulo}\n  ERROR: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('conexion: FALLO ->', error.message);
    process.exitCode = 1;
  } finally {
    await cliente.end().catch(() => {});
  }
})();
