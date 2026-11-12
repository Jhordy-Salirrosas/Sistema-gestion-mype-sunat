/**
 * E2E de escritura reversible contra un entorno de pruebas.
 * Requiere E2E_ALLOW_WRITES=1.
 * Flujo: gasto -> pago -> anulación; cobro -> anulación.
 */
const base = (process.env.E2E_BACKEND_URL || 'https://sistema-mype-sunat-back.onrender.com').replace(/\/$/, '');
const email = process.env.E2E_EMAIL || 'admin@mype.pe';
const password = process.env.E2E_PASSWORD || 'Password123!#';
const marca = `E2E ${new Date().toISOString().slice(0, 19)}`;

if (process.env.E2E_ALLOW_WRITES !== '1') {
  console.log('E2E de escritura omitido. Ejecute con E2E_ALLOW_WRITES=1 en un entorno de pruebas.');
  process.exit(0);
}

async function api(nombre, path, init = {}, token) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const texto = await res.text();
  let data = null; try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }
  console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${nombre}: HTTP ${res.status}`);
  if (!res.ok) throw new Error(`${nombre}: ${String(texto).slice(0, 220)}`);
  return data;
}

(async () => {
  const login = await api('login', '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.accessToken;

  const gasto = await api('crear gasto', '/api/v1/expenses', { method: 'POST', body: JSON.stringify({ description: marca, supplierName: 'Proveedor E2E', supplierDoc: '20100070970', documentNumber: 'E2E-1', baseAmount: 100, igvAmount: 18, totalAmount: 118 }) }, token);
  await api('pagar gasto', `/api/v1/expenses/${gasto.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: 118, paymentMethod: 'TRANSFERENCIA' }) }, token);
  const anuladoGasto = await api('anular gasto pagado', `/api/v1/expenses/${gasto.id}/annul`, { method: 'POST', body: '{}' }, token);
  if (anuladoGasto.status !== 'ANULADO') throw new Error('El gasto no quedó ANULADO');

  const cartera = await api('cartera', '/api/v1/collections/receivables', {}, token);
  const factura = Array.isArray(cartera) ? cartera.find((f) => Number(f.balance) > 0) : null;
  if (factura) {
    const cobro = await api('crear cobro', '/api/v1/collections', { method: 'POST', body: JSON.stringify({ customerName: factura.customerName, customerDoc: factura.customerDoc, invoiceNumber: factura.numero, amount: Math.min(1, Number(factura.balance)), paymentMethod: 'TRANSFERENCIA' }) }, token);
    const anuladoCobro = await api('anular cobro', `/api/v1/collections/${cobro.id}/annul`, { method: 'POST', body: '{}' }, token);
    if (anuladoCobro.status !== 'ANULADO') throw new Error('El cobro no quedó ANULADO');
  } else {
    console.log('SKIP cobro: no hay facturas con saldo.');
  }

  console.log(`\nE2E WRITE OK. Gasto ${gasto.id} anulado.`);
})().catch((error) => { console.error('E2E WRITE FAIL:', error.message); process.exitCode = 1; });
