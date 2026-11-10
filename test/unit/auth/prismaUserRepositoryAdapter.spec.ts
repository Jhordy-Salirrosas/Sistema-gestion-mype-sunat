import { PrismaService } from '../../../src/database/prismaService';
import { CompanyEntity } from '../../../src/modules/auth/domain/entities/companyEntity';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import { PrismaUserRepositoryAdapter } from '../../../src/modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter';

describe('PrismaUserRepositoryAdapter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('does not return mock tenants when production lookup finds no user', async () => {
    process.env.NODE_ENV = 'production';
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findUnique: jest.fn().mockResolvedValue(null) },
      refreshToken: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const repository = new PrismaUserRepositoryAdapter(prisma);

    await expect(repository.findByEmail('missing@example.test')).resolves.toBeNull();
    await expect(repository.findById('missing-user', 'missing-company')).resolves.toBeNull();
    await expect(repository.findByRuc('20100070970')).resolves.toBeNull();
    await expect(repository.findCompanyById('missing-company')).resolves.toBeNull();
    await expect(repository.findRefreshToken('missing-token')).resolves.toBeNull();
  });

  it('maps persisted users, companies and refresh tokens in production', async () => {
    process.env.NODE_ENV = 'production';
    const repository = new PrismaUserRepositoryAdapter({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-id',
          company_id: 'company-id',
          email: 'demo@example.test',
          password_hash: 'fake-password-hash',
          full_name: 'Demo User',
          role: 'ADMIN',
          is_active: true,
        }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'company-id',
          ruc: '20100070970',
          legal_name: 'Demo Company',
          trade_name: null,
          sol_user: 'DEMO_SOL_USER',
          sol_pass_encrypted: 'sol:v1:fake-ciphertext',
          cert_storage_url: null,
          cert_pass_encrypted: null,
          sire_client_id_enc: null,
          sire_client_secret_enc: null,
          is_active: true,
        }),
      },
      refreshToken: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'refresh-id',
          user_id: 'user-id',
          token_hash: 'fake-token-hash',
          expires_at: new Date('2027-01-01T00:00:00.000Z'),
          is_revoked: false,
        }),
      },
    } as unknown as PrismaService);

    await expect(repository.findByEmail('demo@example.test')).resolves.toMatchObject({
      user: { id: 'user-id', companyId: 'company-id' },
      passwordHash: 'fake-password-hash',
    });
    await expect(repository.findById('user-id')).resolves.toMatchObject({
      id: 'user-id',
      companyId: 'company-id',
    });
    await expect(repository.findByRuc('20100070970')).resolves.toMatchObject({
      id: 'company-id',
      solPassEncrypted: 'sol:v1:fake-ciphertext',
    });
    await expect(repository.findCompanyById('company-id')).resolves.toMatchObject({
      id: 'company-id',
      legalName: 'Demo Company',
    });
    await expect(repository.findRefreshToken('fake-token-hash')).resolves.toMatchObject({
      id: 'refresh-id',
      userId: 'user-id',
    });
  });

  it('propagates production database failures instead of falling back to demo data', async () => {
    process.env.NODE_ENV = 'production';
    const persistenceError = new Error('database unavailable');
    const reject = jest.fn().mockRejectedValue(persistenceError);
    const repository = new PrismaUserRepositoryAdapter({
      user: { findFirst: reject, update: reject },
      company: { findUnique: reject },
      refreshToken: { create: reject, findFirst: reject, updateMany: reject },
      $transaction: reject,
    } as unknown as PrismaService);

    await expect(repository.findByEmail('demo@example.test')).rejects.toBe(persistenceError);
    await expect(repository.findById('user-id')).rejects.toBe(persistenceError);
    await expect(repository.findByRuc('20100070970')).rejects.toBe(persistenceError);
    await expect(repository.findCompanyById('company-id')).rejects.toBe(persistenceError);
    await expect(repository.findRefreshToken('token-hash')).rejects.toBe(persistenceError);
    await expect(repository.saveRefreshToken('user-id', 'token-hash', new Date())).rejects.toBe(persistenceError);
    await expect(repository.revokeRefreshToken('token-hash')).rejects.toBe(persistenceError);
    await expect(repository.revokeAllUserRefreshTokens('user-id')).rejects.toBe(persistenceError);
    await expect(repository.updatePassword('user-id', 'password-hash')).rejects.toBe(persistenceError);
    await expect(repository.updateProfile('user-id', 'Demo User')).rejects.toBe(persistenceError);
  });

  it('keeps offline fallback behavior limited to non-production environments', async () => {
    process.env.NODE_ENV = 'test';
    const reject = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const repository = new PrismaUserRepositoryAdapter({
      user: { findFirst: reject, update: reject },
      company: { findUnique: reject },
      refreshToken: { create: reject, findFirst: reject, updateMany: reject },
    } as unknown as PrismaService);

    await expect(repository.findByEmail('demo@example.test')).resolves.toMatchObject({
      user: { id: 'mock-admin-id' },
    });
    await expect(repository.findById('', '')).resolves.toMatchObject({
      id: 'mock-admin-id',
      companyId: 'mock-company-id',
    });
    await expect(repository.findByRuc('')).resolves.toMatchObject({
      id: 'mock-company-id',
      ruc: '20601012341',
    });
    await expect(repository.findCompanyById('')).resolves.toMatchObject({
      id: 'mock-company-id',
    });
    await expect(repository.findRefreshToken('fake-token-hash')).resolves.toMatchObject({
      userId: 'mock-admin-id',
      tokenHash: 'fake-token-hash',
    });
    await expect(repository.saveRefreshToken('user-id', 'token-hash', new Date())).resolves.toMatchObject({
      id: 'mock-refresh-token-id',
    });
    await expect(repository.revokeRefreshToken('token-hash')).resolves.toBeUndefined();
    await expect(repository.revokeAllUserRefreshTokens('user-id')).resolves.toBeUndefined();
    await expect(repository.updatePassword('user-id', 'password-hash')).resolves.toBeUndefined();
    await expect(repository.updateProfile('user-id', ' Demo User ')).resolves.toMatchObject({
      id: 'user-id',
      fullName: 'Demo User',
    });
  });

  it('propagates failed registration transactions instead of returning input entities', async () => {
    process.env.NODE_ENV = 'production';
    const persistenceError = new Error('database unavailable');
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(persistenceError),
    } as unknown as PrismaService;
    const repository = new PrismaUserRepositoryAdapter(prisma);
    const user = new UserEntity({
      id: 'user-id',
      companyId: 'company-id',
      email: 'demo@example.test',
      fullName: 'Demo User',
      role: 'ADMIN',
      isActive: true,
    });
    const company = new CompanyEntity({
      id: 'company-id',
      ruc: '20100070970',
      legalName: 'Demo Company',
      solUser: 'DEMO_SOL_USER',
      solPassEncrypted: 'sol:v1:fake-ciphertext',
      isActive: true,
    });

    await expect(
      repository.createUserWithCompany({
        user,
        company,
        passwordHash: 'fake-password-hash',
      }),
    ).rejects.toBe(persistenceError);
  });

  it('audits credential storage without adding credential values to the audit record', async () => {
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const companyRow = {
      id: 'company-id',
      ruc: '20100070970',
      legal_name: 'Demo Company',
      trade_name: null,
      sol_user: 'DEMO_SOL_USER',
      sol_pass_encrypted: 'sol:v1:fake-ciphertext',
      cert_storage_url: null,
      cert_pass_encrypted: null,
      sire_client_id_enc: null,
      sire_client_secret_enc: null,
      is_active: true,
    };
    const userRow = {
      id: 'user-id',
      company_id: 'company-id',
      email: 'demo@example.test',
      password_hash: 'fake-password-hash',
      full_name: 'Demo User',
      role: 'ADMIN',
      is_active: true,
    };
    const transaction = {
      company: { create: jest.fn().mockResolvedValue(companyRow) },
      user: { create: jest.fn().mockResolvedValue(userRow) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      accountingRule: { createMany: jest.fn().mockResolvedValue({ count: 23 }) },
      auditLog,
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService;
    const repository = new PrismaUserRepositoryAdapter(prisma);

    await repository.createUserWithCompany({
      user: new UserEntity({
        id: 'user-id',
        companyId: 'company-id',
        email: 'demo@example.test',
        fullName: 'Demo User',
        role: 'ADMIN',
        isActive: true,
      }),
      company: new CompanyEntity({
        id: 'company-id',
        ruc: '20100070970',
        legalName: 'Demo Company',
        solUser: 'DEMO_SOL_USER',
        solPassEncrypted: 'sol:v1:fake-ciphertext',
        isActive: true,
      }),
      passwordHash: 'fake-password-hash',
    });

    const auditData = auditLog.create.mock.calls[0][0].data;
    expect(auditData).toEqual(
      expect.objectContaining({
        action: 'SOL_CREDENTIALS_ENCRYPTED',
        ip_address: 'desconocida',
        user_agent: null,
        new_values: { sol_credentials: 'encrypted_at_rest' },
      }),
    );
    expect(JSON.stringify(auditData)).not.toContain('fake-ciphertext');
  });
});
