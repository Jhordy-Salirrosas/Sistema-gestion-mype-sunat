import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client/client';
import { seedCustoms } from '../prisma/seeds/customs.seed';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$connect();
    await seedCustoms(prisma);
  } catch (error) {
    console.error('Error durante la ejecución del seed de aduanas:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
