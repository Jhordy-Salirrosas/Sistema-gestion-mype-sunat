import { IssuerConfigResolver } from '../../../src/modules/sunat/issuerConfigResolver';
import { IssuerConfigEncryption } from '../../../src/modules/sunat/issuerConfigEncryption';

describe('D1 company issuer resolution', () => {
  const env = { ...process.env };
  const encryption = new IssuerConfigEncryption();
  let company: any;
  let db: any;
  let resolver: IssuerConfigResolver;
  beforeEach(() => {
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
      'base64',
    );
    process.env.SUNAT_SOL_USER = 'FAKE_DEPLOY';
    process.env.SUNAT_SOL_PASSWORD = 'fake-deployment-password';
    process.env.CERT_BASE64 = 'fake-deployment-cert';
    process.env.CERT_PASSWORD = 'fake-deployment-cert-password';
    process.env.SUNAT_ENV = 'beta';
    company = {
      id: 'a',
      ruc: '20000000001',
      issuer_config_activated_at: null,
      issuer_config_version: null,
      issuer_environment: null,
      sol_user: 'legacy',
      sol_pass_encrypted: 'legacy-plaintext',
      cert_storage_url: 'https://legacy.invalid',
      cert_pass_encrypted: 'legacy',
    };
    db = {
      company: { findUnique: jest.fn(async () => company) },
      issuerCertificate: { findFirst: jest.fn(async () => null) },
    };
    resolver = new IssuerConfigResolver(db, encryption);
  });
  afterAll(() => {
    process.env = env;
  });
  const activate = () =>
    Object.assign(company, {
      issuer_config_activated_at: new Date(),
      issuer_config_version: 'v1',
      sol_user: '',
      sol_pass_encrypted: '',
      cert_storage_url: null,
      cert_pass_encrypted: null,
    });
  it('never reinterprets legacy rows, including without an encryption key', async () => {
    delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
    const result = await resolver.resolve('a');
    expect(result.source).toBe('deployment');
    expect(result.sol?.password).toBe('fake-deployment-password');
    expect(db.issuerCertificate.findFirst).not.toHaveBeenCalled();
  });
  it('prefers activated company SOL and keeps certificate group from deployment', async () => {
    activate();
    company.issuer_sol_configured = true;
    company.sol_user = 'FAKE_COMPANY';
    company.sol_pass_encrypted = encryption.encrypt(
      'fake-company-password',
      'a',
      'sol_pass_encrypted',
    );
    const before = { ...process.env };
    const result = await resolver.resolve('a');
    expect(result.sol).toEqual({
      username: '20000000001FAKE_COMPANY',
      password: 'fake-company-password',
    });
    expect(result.certificate).toEqual({
      base64: 'fake-deployment-cert',
      password: 'fake-deployment-cert-password',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sol)).toBe(true);
    expect(process.env).toEqual(before);
  });
  it('keeps complete fallback groups for activated environment only', async () => {
    activate();
    company.issuer_environment = 'PRODUCCION';
    const result = await resolver.resolve('a');
    expect(result.environment).toBe('PRODUCCION');
    expect(result.endpoint).toContain('e-factura');
    expect(result.sol?.password).toBe('fake-deployment-password');
  });
  it.each(['sol', 'certificate'])(
    'rejects partial persisted %s group',
    async (group) => {
      activate();
      if (group === 'sol') {
        company.issuer_sol_configured = true;
        company.sol_user = 'FAKE_ONLY_USER';
      } else {
        company.issuer_cert_configured = true;
        company.cert_pass_encrypted = 'fake';
      }
      await expect(resolver.resolve('a')).rejects.toThrow('GROUP_INCOMPLETE');
    },
  );
  it('never falls back on corrupt ciphertext', async () => {
    activate();
    company.issuer_sol_configured = true;
    company.sol_user = 'FAKE';
    company.sol_pass_encrypted = 'invalid';
    await expect(resolver.resolve('a')).rejects.toThrow(
      'ISSUER_CONFIG_DECRYPTION_FAILED',
    );
  });
  it('resolves private certificate by company and decrypts both parts', async () => {
    activate();
    company.issuer_cert_configured = true;
    company.cert_storage_url = 'private:object';
    company.cert_pass_encrypted = encryption.encrypt(
      'fake-p12-password',
      'a',
      'cert_pass_encrypted',
    );
    db.issuerCertificate.findFirst.mockResolvedValue({
      encrypted_content: encryption.encrypt(
        'fake-p12-data',
        'a',
        'certificate_pkcs12',
      ),
    });
    const result = await resolver.resolve('a');
    expect(result.certificate).toEqual({
      base64: 'fake-p12-data',
      password: 'fake-p12-password',
    });
    expect(db.issuerCertificate.findFirst).toHaveBeenCalledWith({
      where: { id: 'object', company_id: 'a' },
    });
  });
  it('requires explicit company and rejects missing companies', async () => {
    await expect(resolver.resolve('')).rejects.toThrow(
      'ISSUER_COMPANY_REQUIRED',
    );
    company = null;
    await expect(resolver.resolve('b')).rejects.toThrow(
      'ISSUER_COMPANY_NOT_FOUND',
    );
  });
});

describe('D1 deployment routing remains intact', () => {
  it('does not replace deployment endpoints when only company SOL is activated', async () => {
    const saved = { ...process.env };
    process.env.SUNAT_BILL_SERVICE_URL = 'http://127.0.0.1:9876/billService';
    process.env.SUNAT_CONSULT_SERVICE_URL =
      'http://127.0.0.1:9877/billConsultService';
    try {
      const encryption = new IssuerConfigEncryption();
      const resolver = new IssuerConfigResolver({} as never, encryption);
      const context = await resolver.fromCompany(
        {
          id: 'a',
          ruc: '20000000001',
          issuer_config_activated_at: new Date(),
          issuer_config_version: 'v1',
          issuer_environment: null,
          sol_user: '',
          sol_pass_encrypted: '',
          cert_storage_url: null,
          cert_pass_encrypted: null,
        },
        {} as never,
      );
      expect(context.endpoint).toBe(process.env.SUNAT_BILL_SERVICE_URL);
      expect(context.consultEndpoint).toBe(
        process.env.SUNAT_CONSULT_SERVICE_URL,
      );
    } finally {
      process.env = saved;
    }
  });
});

describe('D1 resolver boundary cases', () => {
  const env = { ...process.env };
  const encryption = new IssuerConfigEncryption();
  const company = () => ({
    id: 'fake-a',
    ruc: '20000000001',
    issuer_config_activated_at: new Date(),
    issuer_config_version: null,
    issuer_environment: null,
    issuer_sol_configured: false,
    issuer_cert_configured: false,
    sol_user: 'FAKE_LEGACY',
    sol_pass_encrypted: 'not-an-envelope',
    cert_storage_url: null,
    cert_pass_encrypted: null,
  });
  beforeEach(() => {
    process.env = {
      ...env,
      ISSUER_CONFIG_ENCRYPTION_KEY: Buffer.alloc(32, 29).toString('base64'),
    };
  });
  afterAll(() => {
    process.env = env;
  });
  it.each(['PRODUCTION', 'PRODUCCION', 'BETA', 'unknown', undefined])(
    'resolves legacy environment %s with complete-group fallback',
    async (value) => {
      if (value === undefined) delete process.env.SUNAT_ENV;
      else process.env.SUNAT_ENV = value;
      process.env.SUNAT_SOL_USER = '20000000001FAKE';
      process.env.SUNAT_SOL_PASSWORD = 'fake-password';
      delete process.env.CERT_BASE64;
      delete process.env.CERT_PASSWORD;
      delete process.env.SUNAT_CONSULT_SERVICE_URL;
      const row = { ...company(), issuer_config_activated_at: null };
      const context = await new IssuerConfigResolver(
        {} as never,
        encryption,
      ).fromCompany(row, {} as never);
      expect(context.environment).toBe(
        value?.startsWith('PROD')
          ? 'PRODUCCION'
          : value === 'BETA'
            ? 'BETA'
            : null,
      );
      expect(context.sol?.username).toBe('20000000001FAKE');
      expect(context.certificate).toBeNull();
      expect(context.consultEndpoint).toBe(
        context.endpoint.replace(/\/billService$/, '/billConsultService'),
      );
    },
  );
  it.each(['user', 'password', 'base64', 'certPassword'])(
    'never mixes an incomplete deployment group with an inactive persisted %s',
    async (missing) => {
      process.env.SUNAT_SOL_USER = 'FAKE';
      process.env.SUNAT_SOL_PASSWORD = 'fake-password';
      process.env.CERT_BASE64 = 'fake-data';
      process.env.CERT_PASSWORD = 'fake-cert-password';
      delete process.env[
        {
          user: 'SUNAT_SOL_USER',
          password: 'SUNAT_SOL_PASSWORD',
          base64: 'CERT_BASE64',
          certPassword: 'CERT_PASSWORD',
        }[missing]!
      ];
      const context = await new IssuerConfigResolver(
        {} as never,
        encryption,
      ).fromCompany(company(), {} as never);
      expect(
        missing === 'user' || missing === 'password'
          ? context.sol
          : context.certificate,
      ).toBeNull();
    },
  );
  it('retains an already-prefixed company SOL username and defaults a missing version', async () => {
    const row = {
      ...company(),
      issuer_sol_configured: true,
      sol_user: '20000000001FAKE',
      sol_pass_encrypted: encryption.encrypt(
        'fake',
        'fake-a',
        'sol_pass_encrypted',
      ),
      issuer_environment: 'BETA',
    };
    const result = await new IssuerConfigResolver(
      {} as never,
      encryption,
    ).fromCompany(row, {} as never);
    expect(result.sol?.username).toBe(row.sol_user);
    expect(result.version).toBe('');
    expect(result.endpoint).toContain('e-beta.sunat.gob.pe');
  });
  it.each([
    { cert_storage_url: null, cert_pass_encrypted: 'fake' },
    { cert_storage_url: 'https://public.invalid', cert_pass_encrypted: 'fake' },
    { cert_storage_url: 'private:fake', cert_pass_encrypted: null },
  ])('rejects malformed persisted certificate groups: %j', async (fields) => {
    const db = { issuerCertificate: { findFirst: jest.fn() } };
    await expect(
      new IssuerConfigResolver(db as never, encryption).fromCompany(
        { ...company(), ...fields, issuer_cert_configured: true },
        db as never,
      ),
    ).rejects.toThrow('ISSUER_CERT_GROUP_INCOMPLETE');
    expect(db.issuerCertificate.findFirst).not.toHaveBeenCalled();
  });
  it('requires the private object to belong to the requested company', async () => {
    const db = { issuerCertificate: { findFirst: jest.fn(async () => null) } };
    const row = {
      ...company(),
      issuer_cert_configured: true,
      cert_storage_url: 'private:missing',
      cert_pass_encrypted: 'fake',
    };
    await expect(
      new IssuerConfigResolver(db as never, encryption).fromCompany(
        row,
        db as never,
      ),
    ).rejects.toThrow('ISSUER_CERT_UNAVAILABLE');
    expect(db.issuerCertificate.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', company_id: row.id },
    });
  });
  it('rejects certificate ciphertext copied from another company without fallback', async () => {
    const db = {
      issuerCertificate: {
        findFirst: jest.fn(async () => ({
          encrypted_content: encryption.encrypt(
            'fake-p12',
            'fake-other',
            'certificate_pkcs12',
          ),
        })),
      },
    };
    const row = {
      ...company(),
      issuer_cert_configured: true,
      cert_storage_url: 'private:fake',
      cert_pass_encrypted: encryption.encrypt(
        'fake-password',
        'fake-a',
        'cert_pass_encrypted',
      ),
    };
    await expect(
      new IssuerConfigResolver(db as never, encryption).fromCompany(
        row,
        db as never,
      ),
    ).rejects.toThrow('ISSUER_CONFIG_DECRYPTION_FAILED');
  });
  it('rejects invalid persisted environments instead of silently choosing another identity', async () => {
    await expect(
      new IssuerConfigResolver({} as never, encryption).fromCompany(
        { ...company(), issuer_environment: 'INVALID' },
        {} as never,
      ),
    ).rejects.toThrow('ISSUER_ENV_INVALID');
  });
});
