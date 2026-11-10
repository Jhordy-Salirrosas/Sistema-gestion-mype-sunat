import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client/client';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const list = await prisma.businessPartner.findMany({
    where: { roles: { has: 'IMPORTADOR' } },
    include: { addresses: true, contacts: true, bank_accounts: true },
    orderBy: { legal_name: 'asc' },
  });

  console.log(`TOTAL IMPORTADORES: ${list.length}`);
  for (const p of list) {
    console.log(`• [${p.country_code}] ${p.legal_name} (${p.doc_number})`);
    console.log(`  Roles: ${p.roles.join(', ')}`);
    console.log(`  Ciudad: ${p.addresses[0]?.city ?? 'N/A'}, C.P.: ${p.addresses[0]?.postal_code ?? 'N/A'}`);
    console.log(`  Contacto: ${p.contacts[0]?.name ?? 'N/A'}`);
    console.log(`  Banco: ${p.bank_accounts[0]?.bank_name ?? 'N/A'} | N°: ${p.bank_accounts[0]?.account_number ?? 'N/A'} | SWIFT: ${p.bank_accounts[0]?.swift ?? 'N/A'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

