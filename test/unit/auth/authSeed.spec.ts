import {
  seedAuth,
  DEMO_COMPANY,
  DEMO_USERS,
} from '../../../prisma/seeds/auth.seed';
import type { PrismaClient } from '../../../src/generated/client/client';

describe('AuthSeeder (prisma/seeds/auth.seed.ts)', () => {
  let mockPrisma: jest.Mocked<Partial<PrismaClient>>;

  beforeEach(() => {
    mockPrisma = {
      company: {
        upsert: jest.fn().mockResolvedValue({
          id: 'mocked-company-uuid',
          ruc: DEMO_COMPANY.ruc,
          legal_name: DEMO_COMPANY.legalName,
        }),
      } as any,
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async (params: any) => ({
          id: 'mocked-user-uuid',
          company_id: params.create.company_id,
          email: params.create.email,
          role: params.create.role,
          full_name: params.create.full_name,
        })),
      } as any,
    };
    Object.assign(mockPrisma, { companyRole: {createMany:jest.fn()}, roleMenuPermission:{createMany:jest.fn()}, $transaction:jest.fn(cb=>cb(mockPrisma)) });
  });

  it('debería registrar de forma idempotente la empresa MYPE demo', async () => {
    await seedAuth(mockPrisma as PrismaClient);

    expect(mockPrisma.company?.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ruc: '20601234567' },
        create: expect.objectContaining({
          ruc: '20601234567',
          legal_name: 'SYNC-SUNAT DEMO MYPE S.A.C.',
          sol_user: 'DEMO_SOL_USER',
          sol_pass_encrypted: expect.stringMatching(/^sol:v1:/),
        }),
      }),
    );
  });

  it('debería registrar los 5 roles demo con contraseña segura y hashing criptográfico', async () => {
    await seedAuth(mockPrisma as PrismaClient);

    expect(mockPrisma.user?.upsert).toHaveBeenCalledTimes(5);

    const rolesExpected = [
      'ADMIN',
      'CONTADOR',
      'OPERADOR_FACTURACION',
      'OPERADOR_ADUANAS',
      'AUDITOR',
    ];

    rolesExpected.forEach((expectedRole) => {
      expect(mockPrisma.user?.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            company_id: 'mocked-company-uuid',
            role: expectedRole,
            password_hash: expect.stringMatching(
              /^[a-f0-9]{32}:[a-f0-9]{128}$/,
            ),
            is_active: true,
          }),
        }),
      );
    });
  });

  it('debería incluir los correos oficiales definidos en la especificación', async () => {
    await seedAuth(mockPrisma as PrismaClient);

    const expectedEmails = DEMO_USERS.map((u) => u.email);

    expectedEmails.forEach((email) => {
      expect(mockPrisma.user?.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email, company_id: 'mocked-company-uuid' }),
        }),
      );
    });
  });
  it('no modifica un usuario demo cuyo correo ya pertenece a otra empresa', async () => {
    (mockPrisma.user as any).findUnique.mockResolvedValue({company_id:'otra-empresa'});
    await expect(seedAuth(mockPrisma as PrismaClient)).rejects.toThrow('pertenece a otra empresa');
    expect(mockPrisma.user?.upsert).not.toHaveBeenCalled();
  });

});
