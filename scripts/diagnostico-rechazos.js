/**
 * Diagnóstico de solo lectura de comprobantes no aceptados.
 * Muestra estado actual y el último evento de transaction_history.
 */
require('dotenv/config');
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT i.serie, i.correlativo, i.estado, i.fecha_emision,
             h.codigo_error, h.mensaje_error, h.created_at
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT codigo_error, mensaje_error, created_at
        FROM transaction_history
        WHERE invoice_id = i.id
        ORDER BY created_at DESC
        LIMIT 1
      ) h ON true
      WHERE i.estado NOT IN ('ACEPTADO', 'ANULADO')
      ORDER BY i.fecha_emision DESC, i.serie, i.correlativo
    `);
    if (res.rows.length === 0) {
      console.log('No hay comprobantes rechazados ni con error de red.');
      return;
    }
    for (const r of res.rows) {
      console.log(`\n${r.serie}-${String(r.correlativo).padStart(8, '0')}  ${r.estado}  ${r.fecha_emision.toISOString().slice(0, 10)}`);
      console.log(`  código: ${r.codigo_error ?? '—'}`);
      console.log(`  motivo: ${(r.mensaje_error ?? 'sin detalle').replace(/\s+/g, ' ').slice(0, 400)}`);
    }
  } catch (error) {
    console.error('No se pudo consultar:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
