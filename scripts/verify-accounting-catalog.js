/**
 * Verifica que la configuración contable apunte a cuentas que existen.
 *
 * Es una comprobación de despliegue, no una prueba unitaria: se corre contra la
 * base real después de aplicar migraciones y semilla.
 *
 *   node -r dotenv/config scripts/verify-accounting-catalog.js
 *
 * Sale con código 1 si encuentra algo, para poder usarlo como paso de CI o de
 * despliegue. Revisa tres cosas:
 *   1. que el catálogo PCGE tenga cuentas;
 *   2. que las reglas activas de cada empresa apunten a cuentas existentes y de
 *      posteo (no a una cuenta de mayor con subcuentas);
 *   3. que los mapeos guardados apunten a cuentas existentes.
 */
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/client/client.js');

/** Una cuenta es agregada solo si tiene hijas y está en nivel de subcuenta. */
const cuentasAgregadas = (cuentas) => {
  const padres = new Set();
  for (const cuenta of cuentas) {
    if (cuenta.parent_code && cuenta.parent_code.length < 5) padres.add(cuenta.parent_code);
  }
  return padres;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL: configure el .env antes de ejecutar la verificación.');
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const problemas = [];

  try {
    const cuentas = await prisma.accountingAccount.findMany({
      select: { code: true, parent_code: true, is_active: true },
    });
    const porCodigo = new Map(cuentas.map((c) => [c.code, c]));
    const agregadas = cuentasAgregadas(cuentas);

    console.log(`Catálogo PCGE: ${cuentas.length} cuentas`);
    if (cuentas.length === 0) problemas.push('El catálogo PCGE está vacío: corra la semilla.');

    const revisar = (origen, codigo) => {
      const cuenta = porCodigo.get(codigo);
      if (!cuenta) {
        problemas.push(`${origen}: la cuenta ${codigo} no existe`);
        return;
      }
      if (cuenta.is_active === false) problemas.push(`${origen}: la cuenta ${codigo} está inactiva`);
      if (agregadas.has(codigo)) {
        problemas.push(`${origen}: la cuenta ${codigo} es de mayor y tiene subcuentas`);
      }
    };

    const reglas = await prisma.accountingRule.findMany({
      where: { is_active: true },
      select: { company_id: true, process_code: true, line_order: true, account_code: true },
    });
    for (const regla of reglas) {
      revisar(`regla ${regla.process_code} línea ${regla.line_order}`, regla.account_code);
    }
    console.log(`Reglas activas revisadas: ${reglas.length}`);

    const mapeos = await prisma.accountingMapping.findMany({
      where: { is_active: true },
      select: { process_code: true, role_code: true, account_code: true },
    });
    for (const mapeo of mapeos) {
      revisar(`mapeo ${mapeo.process_code}/${mapeo.role_code}`, mapeo.account_code);
    }
    console.log(`Mapeos activos revisados: ${mapeos.length}`);
  } finally {
    await prisma.$disconnect();
  }

  if (problemas.length > 0) {
    console.error(`\n${problemas.length} problema(s) de configuración contable:`);
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  console.log('\nConfiguración contable consistente.');
}

main().catch((error) => {
  console.error('Error al verificar la configuración contable:', error.message);
  process.exit(1);
});
