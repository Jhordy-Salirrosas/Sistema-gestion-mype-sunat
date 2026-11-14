/**
 * Repara la configuración contable de una empresa para que las pantallas nuevas
 * dejen de mostrar cuentas inválidas.
 *
 *   node -r dotenv/config scripts/fix-accounting-config.js            # solo informa
 *   node -r dotenv/config scripts/fix-accounting-config.js --aplicar  # escribe
 *
 * Qué hace:
 *  1. Lista las empresas cuyo RUC no supera el módulo 11 (el PLE las rechaza).
 *  2. Repunta las reglas que quedaron en cuentas de mayor: 611 → 6111 y
 *     759 → 7599. Son correcciones del catálogo, no decisiones de negocio.
 *  3. Informa (sin tocar) las reglas 74 y 659, que sí requieren decisión del
 *     contador.
 *
 * No modifica asientos, comprobantes ni saldos.
 */
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/client/client.js');

const APLICAR = process.argv.includes('--aplicar');
const CORRECCIONES = [
  { de: '611', a: '6111', motivo: '611 es cuenta de mayor; la variación se postea en 6111' },
  { de: '759', a: '7599', motivo: '759 es cuenta de mayor; los sobrantes van a 7599' },
];
const PENDIENTES_DE_DECISION = ['74', '659'];

const esRucValido = (ruc) => {
  if (typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) return false;
  if (!['10', '15', '16', '17', '20'].includes(ruc.slice(0, 2))) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i += 1) suma += Number(ruc[i]) * pesos[i];
  let digito = 11 - (suma % 11);
  if (digito === 10) digito = 0;
  if (digito === 11) digito = 1;
  return digito === Number(ruc[10]);
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL: configure el .env.');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const empresas = await prisma.company.findMany({ select: { id: true, ruc: true, legal_name: true } });
    console.log(`Empresas: ${empresas.length}`);
    const invalidas = empresas.filter((e) => !esRucValido(e.ruc));
    if (invalidas.length === 0) {
      console.log('  RUC: todos válidos (módulo 11).');
    } else {
      console.log('  RUC inválidos (el PLE los rechaza):');
      for (const e of invalidas) console.log(`   - ${e.ruc}  ${e.legal_name}  (id ${e.id})`);
      console.log('   Corrija el RUC de la empresa desde Configuración antes de exportar el PLE.');
    }

    for (const correccion of CORRECCIONES) {
      const reglas = await prisma.accountingRule.findMany({
        where: { account_code: correccion.de, is_active: true },
        select: { id: true, company_id: true, process_code: true, line_order: true, account_code: true },
      });
      console.log(`\n${correccion.de} -> ${correccion.a}: ${reglas.length} regla(s) · ${correccion.motivo}`);
      for (const r of reglas) {
        console.log(`   - empresa ${r.company_id} · ${r.process_code} línea ${r.line_order}`);
      }
      if (APLICAR && reglas.length > 0) {
        const { count } = await prisma.accountingRule.updateMany({
          where: { id: { in: reglas.map((r) => r.id) } },
          data: { account_code: correccion.a },
        });
        console.log(`   aplicadas: ${count}`);
      }
    }

    const pendientes = await prisma.accountingRule.findMany({
      where: { account_code: { in: PENDIENTES_DE_DECISION }, is_active: true },
      select: { account_code: true, process_code: true, line_order: true },
    });
    if (pendientes.length > 0) {
      console.log('\nPendientes de decisión del contador (no se tocan):');
      for (const p of pendientes) console.log(`   - ${p.account_code} · ${p.process_code} línea ${p.line_order}`);
    }

    if (!APLICAR) console.log('\nModo informativo. Repita con --aplicar para escribir los cambios.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
