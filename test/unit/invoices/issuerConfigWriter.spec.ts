import { BadRequestException } from '@nestjs/common';
import { issuerConfigHarness } from '../../fixtures/issuerConfigHarness';
import { validateIssuerInput } from '../../../src/modules/invoices/application/services/issuerConfigWriter';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';

describe('D1 issuer configuration write boundary', () => {
  const environment = { ...process.env };
  let h: ReturnType<typeof issuerConfigHarness>;
  beforeEach(() => {
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString(
      'base64',
    );
    process.env.SUNAT_SOL_USER = 'FAKE_BACKUP';
    process.env.SUNAT_SOL_PASSWORD = 'obviously-fake-backup';
    h = issuerConfigHarness();
  });
  afterAll(() => {
    process.env = environment;
  });
  it.each([
    null,
    undefined,
    [],
    'fake',
    3,
    { companyId: 'another' },
    { company_id: 'another' },
    { ruc: '20000000002' },
    { sol_password: 7 },
    { action: 'other' },
    { entorno: 'DEV' },
    { action: 'reset', entorno: 'MOCK' },
    { sol_user: 'x'.repeat(65) },
    { sol_password: 'x'.repeat(257) },
    { cert_password: 'x'.repeat(257) },
    { cert_base64: 'x'.repeat(131073) },
  ])(
    'rejects invalid input without opening a transaction: %j',
    async (input) => {
      await expect(h.writer.save(h.company.id, input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(h.db.$transaction).not.toHaveBeenCalled();
    },
  );
  it('accepts only the closed DTO at its documented limits', () => {
    const input = {
      action: 'save',
      entorno: 'PRODUCCION',
      sol_user: 'x'.repeat(64),
      sol_password: 'x'.repeat(256),
      cert_password: 'x'.repeat(256),
      cert_base64: 'x'.repeat(131072),
    };
    expect(validateIssuerInput(input)).toEqual(input);
  });
  it('requires explicit company and rejects a missing company', async () => {
    await expect(h.writer.save('', {})).rejects.toThrow(
      'ISSUER_COMPANY_REQUIRED',
    );
    expect(h.db.$transaction).not.toHaveBeenCalled();
    h.db.company.findUnique.mockResolvedValue(null as never);
    await expect(h.writer.save(h.company.id, {})).rejects.toThrow(
      'ISSUER_COMPANY_NOT_FOUND',
    );
    expect(h.db.company.update).not.toHaveBeenCalled();
  });
  it('encrypts both groups, uses a private certificate reference and validates before update', async () => {
    const before = { ...process.env };
    await h.writer.save(h.company.id, {
      entorno: 'BETA',
      sol_user: ' FAKE_SOL ',
      sol_password: 'obviously-fake-sol',
      cert_password: 'obviously-fake-p12',
      cert_base64: 'ZmFrZQ==',
    });
    expect(h.db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.company).toMatchObject({
      sol_user: 'FAKE_SOL',
      issuer_sol_configured: true,
      issuer_cert_configured: true,
      issuer_environment: 'BETA',
    });
    expect(h.company.cert_storage_url).toMatch(/^private:/);
    expect(h.company.sol_pass_encrypted).not.toContain('obviously-fake-sol');
    expect(h.company.cert_pass_encrypted).not.toContain('obviously-fake-p12');
    expect((await h.resolver.resolve(h.company.id)).certificate).toEqual({
      base64: 'ZmFrZQ==',
      password: 'obviously-fake-p12',
    });
    expect(h.certificates.validarYCargarCertificado).toHaveBeenCalledWith(
      'ZmFrZQ==',
      'obviously-fake-p12',
      h.company.ruc,
    );
    expect(
      h.certificates.validarYCargarCertificado.mock.invocationCallOrder[0],
    ).toBeLessThan(h.db.company.update.mock.invocationCallOrder[0]);
    expect(process.env).toEqual(before);
  });
  it.each([
    {},
    { sol_password: '' },
    { sol_password: '   ' },
    { sol_password: '********' },
    { sol_password: '••••••' },
    { cert_password: '●●●●' },
    { cert_base64: '' },
  ])('preserves omitted/empty/masked managed secrets: %j', async (partial) => {
    await h.writer.save(h.company.id, {
      entorno: 'MOCK',
      sol_user: 'FAKE',
      sol_password: 'fake-password',
      cert_base64: 'ZmFrZQ==',
      cert_password: 'fake-certificate-password',
    });
    const saved = {
      sol: h.company.sol_pass_encrypted,
      cert: h.company.cert_pass_encrypted,
      ref: h.company.cert_storage_url,
    };
    h.certificates.validarYCargarCertificado.mockClear();
    await h.writer.save(h.company.id, partial);
    expect(h.company.sol_pass_encrypted).toBe(saved.sol);
    expect(h.company.cert_pass_encrypted).toBe(saved.cert);
    expect(h.company.cert_storage_url).toBe(saved.ref);
    expect(h.company.issuer_environment).toBe('MOCK');
    expect(h.certificates.validarYCargarCertificado).not.toHaveBeenCalled();
  });
  it('preserves inactive legacy values without interpreting them as ciphertext', async () => {
    delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
    await h.writer.save(h.company.id, { entorno: 'MOCK' });
    expect(h.company.sol_pass_encrypted).toBe('fake-legacy-unmanaged');
    expect((await h.resolver.resolve(h.company.id)).sol?.password).toBe(
      'obviously-fake-backup',
    );
  });
  it.each([
    { sol_user: 'FAKE' },
    { sol_password: 'fake' },
    { cert_base64: 'ZmFrZQ==' },
    { cert_password: 'fake' },
  ])('rejects initial partial credential groups: %j', async (input) => {
    await expect(h.writer.save(h.company.id, input)).rejects.toThrow(
      'GROUP_INCOMPLETE',
    );
    expect(h.db.company.update).not.toHaveBeenCalled();
    expect(h.db.issuerCertificate.create).not.toHaveBeenCalled();
  });
  it('updates only the managed username or password without mixing with deployment', async () => {
    await h.writer.save(h.company.id, {
      sol_user: 'FAKE',
      sol_password: 'fake-original',
    });
    await h.writer.save(h.company.id, { sol_user: 'FAKE_ROTATED' });
    expect((await h.resolver.resolve(h.company.id)).sol?.password).toBe(
      'fake-original',
    );
    await h.writer.save(h.company.id, { sol_password: 'fake-new' });
    expect((await h.resolver.resolve(h.company.id)).sol).toEqual({
      username: h.company.ruc + 'FAKE_ROTATED',
      password: 'fake-new',
    });
  });
  it('rejects invalid base64 before storing an object', async () => {
    await expect(
      h.writer.save(h.company.id, {
        cert_base64: 'not base64!',
        cert_password: 'fake',
      }),
    ).rejects.toThrow('CONFIG_CERT_INVALID');
    expect(h.db.issuerCertificate.create).not.toHaveBeenCalled();
    expect(h.db.company.update).not.toHaveBeenCalled();
  });
  it('revalidates an existing certificate when only its password changes', async () => {
    await h.writer.save(h.company.id, {
      cert_base64: 'ZmFrZQ==',
      cert_password: 'fake-old',
    });
    await h.writer.save(h.company.id, { cert_password: 'fake-new' });
    expect(h.certificates.validarYCargarCertificado).toHaveBeenLastCalledWith(
      'ZmFrZQ==',
      'fake-new',
      h.company.ruc,
    );
    expect(h.db.issuerCertificate.create).toHaveBeenCalledTimes(1);
  });
  it('sanitizes certificate parser errors and does not update the company', async () => {
    h.certificates.validarYCargarCertificado.mockImplementation(() => {
      throw new Error('obviously-fake-sensitive-parser-detail');
    });
    await expect(
      h.writer.save(h.company.id, {
        cert_base64: 'ZmFrZQ==',
        cert_password: 'fake',
      }),
    ).rejects.toThrow(/^CONFIG_CERT_INVALID$/);
    expect(h.db.company.update).not.toHaveBeenCalled();
  });
  it('rejects encrypted writes without a key before storing anything', async () => {
    delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
    await expect(
      h.writer.save(h.company.id, { sol_user: 'FAKE', sol_password: 'fake' }),
    ).rejects.toThrow('ISSUER_CONFIG_KEY_UNAVAILABLE');
    expect(h.db.company.update).not.toHaveBeenCalled();
  });
  it('resets explicitly without erasing secrets and can restore a managed group', async () => {
    await h.writer.save(h.company.id, {
      sol_user: 'FAKE',
      sol_password: 'fake-password',
    });
    const encrypted = h.company.sol_pass_encrypted;
    await h.writer.save(h.company.id, { action: 'reset' });
    expect(h.company.issuer_config_activated_at).toBeNull();
    expect(h.company.sol_pass_encrypted).toBe(encrypted);
    expect((await h.resolver.resolve(h.company.id)).source).toBe('deployment');
    await h.writer.save(h.company.id, { entorno: 'BETA' });
    expect((await h.resolver.resolve(h.company.id)).sol?.password).toBe(
      'fake-password',
    );
  });
  it('propagates typed domain errors, sanitizes infrastructure errors', async () => {
    const error = new BadRequestException('FAKE_DOMAIN_ERROR');
    h.db.$transaction.mockRejectedValueOnce(error);
    await expect(h.writer.save(h.company.id, {})).rejects.toBe(error);
    h.db.$transaction.mockRejectedValueOnce(
      new Error('obviously-fake-private-connection-detail'),
    );
    await expect(h.writer.save(h.company.id, {})).rejects.toThrow(
      /^CONFIG_SAVE_FAILED$/,
    );
  });

  it('persiste y resuelve el perfil_comercial (MAYORISTA o MINORISTA) en la configuración del emisor', async () => {
    await h.writer.save(h.company.id, {
      entorno: 'BETA',
      perfil_comercial: 'MAYORISTA',
    });
    expect(h.company.commercial_profile).toBe('MAYORISTA');
    expect((await h.resolver.resolve(h.company.id)).commercialProfile).toBe('MAYORISTA');

    await h.writer.save(h.company.id, {
      perfil_comercial: 'MINORISTA',
    });
    expect(h.company.commercial_profile).toBe('MINORISTA');
    expect((await h.resolver.resolve(h.company.id)).commercialProfile).toBe('MINORISTA');
  });

  it('expone la sección estructurada del certificado digital (archivo, estado y vencimiento) en GET /invoices/config', async () => {
    const seriesMock = { listar: jest.fn(async () => []) };
    const configService = new InvoiceConfigService(
      seriesMock as never,
      h.certificates as never,
      h.resolver,
      h.writer,
    );
    const cfg = await configService.obtener(h.company.id);
    expect(cfg.certificado).toEqual({
      archivo: 'certificado-20000000001.p12 (custodia despliegue)',
      configurado: true,
      estado: 'VIGENTE',
      vence_el: '2099-01-01',
      dias_restantes: 60,
      origen: 'deployment',
    });
  });
});

describe('M1 perfil comercial persistido y resuelto', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
      'base64',
    );
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('una actualización sin perfil conserva el existente y null lo elimina explícitamente', async () => {
    const h = issuerConfigHarness();
    h.company.commercial_profile = 'MAYORISTA';
    await h.writer.save(h.company.id, { entorno: 'BETA' });
    expect(h.company.commercial_profile).toBe('MAYORISTA');
    await h.writer.save(h.company.id, { perfil_comercial: null });
    expect(h.company.commercial_profile).toBeNull();
    expect(
      (await h.resolver.resolve(h.company.id)).commercialProfile,
    ).toBeNull();
  });

  it.each([' mayorista ', 'minorista', 'DESCONOCIDO', null])(
    'resuelve perfil %s antes de activar configuración propia',
    async (perfil) => {
      const h = issuerConfigHarness();
      h.company.commercial_profile = perfil;
      const context = await h.resolver.resolve(h.company.id);
      expect(context.commercialProfile).toBe(
        perfil?.trim().toUpperCase() === 'MAYORISTA'
          ? 'MAYORISTA'
          : perfil === 'minorista'
            ? 'MINORISTA'
            : null,
      );
      expect(context.source).toBe('deployment');
    },
  );

  it('rechaza perfil fuera del dominio sin persistir configuración', async () => {
    const h = issuerConfigHarness();
    await expect(
      h.writer.save(h.company.id, { perfil_comercial: 'DISTRIBUIDOR' }),
    ).rejects.toThrow('CONFIG_PROFILE_INVALID');
    expect(h.db.company.update).not.toHaveBeenCalled();
  });
});
