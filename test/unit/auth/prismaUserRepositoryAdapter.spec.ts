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
    } as unknown as PrismaService;
    const repository = new PrismaUserRepositoryAdapter(prisma);

    await expect(repository.findById('missing-user', 'missing-company')).resolves.toBeNull();
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
      auditContext: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    });

    const auditData = auditLog.create.mock.calls[0][0].data;
    expect(auditData).toEqual(
      expect.objectContaining({
        action: 'SOL_CREDENTIALS_ENCRYPTED',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        new_values: { sol_credentials: 'encrypted_at_rest' },
      }),
    );
    expect(JSON.stringify(auditData)).not.toContain('fake-ciphertext');
  });
});
