/**
 * Encuentra el pooler de Supabase que acepta la conexión.
 * Prueba las combinaciones de región/prefijo/puerto más habituales y se queda
 * con la primera que responde. No imprime la contraseña.
 */
const { Client } = require('pg');

const REF = process.env.SB_REF;
const PASS = process.env.SB_PASS;
if (!REF || !PASS) {
  console.error('Faltan SB_REF o SB_PASS');
  process.exit(1);
}

const prefijos = ['aws-0', 'aws-1'];
const regiones = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'sa-east-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1', 'ca-central-1',
];
const puertos = [6543, 5432];

async function probar(host, puerto) {
  const url = `postgresql://postgres.${REF}:${encodeURIComponent(PASS)}@${host}:${puerto}/postgres`;
  const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await cliente.connect();
    const r = await cliente.query('select current_database() as db, current_user as usuario');
    return { url, dato: r.rows[0] };
  } catch (error) {
    return { error: error.message };
  } finally {
    await cliente.end().catch(() => {});
  }
}

(async () => {
  for (const prefijo of prefijos) {
    for (const region of regiones) {
      const host = `${prefijo}-${region}.pooler.supabase.com`;
      for (const puerto of puertos) {
        const r = await probar(host, puerto);
        if (r.url) {
          console.log(`OK -> ${host}:${puerto}`);
          console.log('   db:', r.dato.db, '| usuario:', r.dato.usuario);
          console.log('   URL: postgresql://postgres.' + REF + ':***@' + host + ':' + puerto + '/postgres');
          process.exit(0);
        }
        if (!/ENOTFOUND|EAI_AGAIN|timeout|ETIMEDOUT/.test(r.error)) {
          console.log(`host ${host}:${puerto} -> ${r.error}`);
        }
      }
    }
  }
  console.log('Ningún pooler aceptó la conexión.');
  process.exitCode = 1;
})();
