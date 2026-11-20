import { initializeCompanyRoles } from '../../src/modules/auth/application/services/roleCatalogService';
import { randomBytes, scryptSync } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/client/client';
import { SolCredentialCipher } from '../../src/modules/auth/infrastructure/security/solCredentialCipher';

export const DEMO_COMPANY = {
  id: '5eaccb4e-a6ec-4f23-9909-85fe7fc9a87e', // ID exacta vinculada con el frontend
  ruc: '20601234567',
  legalName: 'SYNC-SUNAT DEMO MYPE S.A.C.',
  tradeName: 'DEMO MYPE',
  solUser: 'DEMO_SOL_USER',
  solPassword: 'fake-demo-sol-password',
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
  const solPasswordEncrypted = new SolCredentialCipher(
    process.env['SOL_CREDENTIALS_ENCRYPTION_KEY'] ?? '',
  ).encrypt(DEMO_COMPANY.solPassword);

  const company = await prisma.$transaction(async tx => {
  const company = await tx.company.upsert({
    where: { ruc: DEMO_COMPANY.ruc },
    update: {
      legal_name: DEMO_COMPANY.legalName,
      trade_name: DEMO_COMPANY.tradeName,
      sunat_issuer_username: DEMO_COMPANY.solUser,
      sunat_issuer_password_enc: solPasswordEncrypted,
      is_active: DEMO_COMPANY.isActive,
    },
    create: {
      id: DEMO_COMPANY.id, // Forzamos la ID predeterminada
      ruc: DEMO_COMPANY.ruc,
      legal_name: DEMO_COMPANY.legalName,
      trade_name: DEMO_COMPANY.tradeName,
      sunat_issuer_username: DEMO_COMPANY.solUser,
      sunat_issuer_password_enc: solPasswordEncrypted,
      is_active: DEMO_COMPANY.isActive,
    },
  });

  await initializeCompanyRoles(tx, company.id);
  return company;
  });

  console.log(
    `Empresa MYPE Demo configurada: ${company.legal_name} (RUC: ${company.ruc}) [ID: ${company.id}]`,
  );

  for (const userDef of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: userDef.email } });
    if (existing && existing.company_id !== company.id) {
      throw new Error(`El correo demo ${userDef.email} pertenece a otra empresa; no se modifica ese usuario.`);
    }
    const passwordHash = hashPassword(userDef.password);

    const user = await prisma.user.upsert({
      where: {
        email: userDef.email,
        company_id: company.id,
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

    console.log(
      `Usuario demo listo: ${user.email} [${user.role}] - Pass: ${userDef.password}`,
    );
  }

  console.log('--- Seeding de Autenticación Completado con Éxito ---');
}
