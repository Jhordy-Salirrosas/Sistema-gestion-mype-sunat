/**
 * Smoke test del despliegue: backend, frontend y proxy /api/v1.
 * Solo hace peticiones GET; no modifica datos.
 */
const backend = process.env.SMOKE_BACKEND_URL || 'https://sistema-mype-sunat-back.onrender.com';
const frontend = process.env.SMOKE_FRONTEND_URL || 'https://sync-sunat.pages.dev';

async function check(nombre, url, esperado) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const ok = esperado.includes(res.status);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}: HTTP ${res.status}`);
    return ok;
  } catch (error) {
    console.log(`FAIL ${nombre}: ${error.message}`);
    return false;
  }
}

(async () => {
  const resultados = await Promise.all([
    check('backend /health', `${backend}/health`, [200]),
    check('frontend', `${frontend}/`, [200]),
    check('proxy API sin token', `${frontend}/api/v1/invoices`, [401]),
  ]);
  if (resultados.includes(false)) {
    console.error('\nDEPLOY SMOKE FAIL');
    process.exitCode = 1;
    return;
  }
  console.log('\nDEPLOY SMOKE OK');
})();
