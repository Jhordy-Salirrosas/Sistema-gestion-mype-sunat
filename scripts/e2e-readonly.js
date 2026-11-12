/**
 * E2E de solo lectura contra el backend desplegado.
 * Hace login real y consulta endpoints de ventas, contabilidad, cobros y compras.
 * No crea, actualiza ni elimina registros.
 */
const base = (process.env.E2E_BACKEND_URL || 'https://sistema-mype-sunat-back.onrender.com').replace(/\/$/, '');
const email = process.env.E2E_EMAIL || 'admin@mype.pe';
const password = process.env.E2E_PASSWORD || 'Password123!#';
const hoy = new Date();
const period = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

async function call(nombre, path, init = {}, token) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const texto = await res.text();
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }
  console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${nombre}: HTTP ${res.status}`);
  if (!res.ok) console.log(`     ${String(texto).slice(0, 220)}`);
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  const fallos = [];
  const login = await call('login', '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!login.ok || !login.data?.accessToken) {
    console.error('E2E FAIL: no se pudo autenticar.');
    process.exitCode = 1;
    return;
  }
  const token = login.data.accessToken;
  const ruc = login.data.user?.companyRuc;
  const comunes = [[`ventas ${period}`, `/api/v1/invoices?limit=5`], [`asientos ${period}`, `/api/v1/accounting/entries?period=${period}`], ['reporte de ventas', '/api/v1/invoices/reports/sales'], ['cartera', '/api/v1/collections/portfolio'], ['cuentas por pagar', '/api/v1/purchases/payables'], ['períodos', '/api/v1/accounting/periods']];
  for (const [nombre, path] of comunes) {
    const r = await call(nombre, path, {}, token);
    if (!r.ok) fallos.push(nombre);
  }
  const validacion = await call('validación PLE ventas', '/api/v1/accounting/ple/tax-validate', {
    method: 'POST',
    body: JSON.stringify({ year: hoy.getFullYear(), month: hoy.getMonth() + 1, bookCode: '140100', companyRuc: ruc }),
  }, token);
  if (!validacion.ok) fallos.push('validación PLE');

  if (fallos.length) {
    console.error(`\nE2E FAIL: ${fallos.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nE2E OK: login, ventas, contabilidad, cobros, compras y PLE (solo lectura).');
})().catch((error) => { console.error('E2E FAIL:', error.message); process.exitCode = 1; });
