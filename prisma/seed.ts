import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client/client';
import { seedAuth } from './seeds/auth.seed';
import { seedCustoms } from './seeds/customs.seed';
import { seedAccounting } from './seeds/accounting.seed';
import { seedAccountingRules } from './seeds/accountingRules.seed';
import { seedInventory } from './seeds/inventory.seed';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log('Iniciando orquestador maestro de semillas (seed.ts)...');
    await prisma.$connect();
    await seedAuth(prisma);
    await seedInventory(prisma);
    await seedCustoms(prisma);
    await seedAccounting(prisma);
    await seedAccountingRules(prisma);
    console.log('Proceso de seed finalizado exitosamente.');
  } catch (error) {
    console.error('Error durante la ejecución del seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
