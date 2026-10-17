import { randomBytes, scryptSync } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/client/client';

export const DEMO_COMPANY = {
  ruc: '20601234567',
  legalName: 'SYNC-SUNAT DEMO MYPE S.A.C.',
  tradeName: 'DEMO MYPE',
  solUser: 'MODDATOS',
  solPassEncrypted: 'MODDATOS',
  isActive: true,
};

export const DEMO_USERS = [
  {
    email: 'admin@mype.pe',
    fullName: 'Administrador General',
    role: 'ADMIN' as const,
    password: 'Password123!#',
  },
  {
    email: 'contador@mype.pe',
    fullName: 'Contador Principal',
    role: 'CONTADOR' as const,
    password: 'Password123!#',
  },
  {
    email: 'facturador@mype.pe',
    fullName: 'Operador de Ventas',
    role: 'OPERADOR_FACTURACION' as const,
    password: 'Password123!#',
  },
  {
    email: 'aduanas@mype.pe',
    fullName: 'Especialista Aduanero',
    role: 'OPERADOR_ADUANAS' as const,
    password: 'Password123!#',
  },
  {
    email: 'auditor@mype.pe',
    fullName: 'Auditor Fiscal',
    role: 'AUDITOR' as const,
    password: 'Password123!#',
  },
];

function hashPassword(plainText: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export async function seedAuth(prisma: PrismaClient) {
  console.log('--- Iniciando Seeding de Autenticación y MYPE Demo ---');

  const company = await prisma.company.upsert({
    where: { ruc: DEMO_COMPANY.ruc },
    update: {
      legal_name: DEMO_COMPANY.legalName,
      trade_name: DEMO_COMPANY.tradeName,
      sol_user: DEMO_COMPANY.solUser,
      sol_pass_encrypted: DEMO_COMPANY.solPassEncrypted,
      is_active: DEMO_COMPANY.isActive,
    },
    create: {
      ruc: DEMO_COMPANY.ruc,
      legal_name: DEMO_COMPANY.legalName,
      trade_name: DEMO_COMPANY.tradeName,
      sol_user: DEMO_COMPANY.solUser,
      sol_pass_encrypted: DEMO_COMPANY.solPassEncrypted,
      is_active: DEMO_COMPANY.isActive,
    },
  });

  console.log(`Empresa MYPE Demo configurada: ${company.legal_name} (RUC: ${company.ruc})`);

  for (const userDef of DEMO_USERS) {
    const passwordHash = hashPassword(userDef.password);

    const user = await prisma.user.upsert({
      where: {
        company_id_email: {
          company_id: company.id,
          email: userDef.email,
        },
      },
      update: {
        full_name: userDef.fullName,
        role: userDef.role,
        password_hash: passwordHash,
        is_active: true,
      },
      create: {
        company_id: company.id,
        email: userDef.email,
        full_name: userDef.fullName,
        role: userDef.role,
        password_hash: passwordHash,
        is_active: true,
      },
    });

    console.log(`Usuario demo listo: ${user.email} [${user.role}] - Pass: ${userDef.password}`);
  }

  console.log('--- Seeding de Autenticación Completado con Éxito ---');
}
