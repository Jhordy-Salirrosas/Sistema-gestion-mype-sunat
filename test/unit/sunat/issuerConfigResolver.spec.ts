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
      if (group === 'sol') company.sol_user = 'FAKE_ONLY_USER';
      else company.cert_pass_encrypted = 'fake';
      await expect(resolver.resolve('a')).rejects.toThrow('GROUP_INCOMPLETE');
    },
  );
  it('never falls back on corrupt ciphertext', async () => {
    activate();
    company.sol_user = 'FAKE';
    company.sol_pass_encrypted = 'invalid';
    await expect(resolver.resolve('a')).rejects.toThrow(
      'ISSUER_CONFIG_DECRYPTION_FAILED',
    );
  });
  it('resolves private certificate by company and decrypts both parts', async () => {
    activate();
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
