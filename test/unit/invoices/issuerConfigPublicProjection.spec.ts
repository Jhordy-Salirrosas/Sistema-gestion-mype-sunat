import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';
import { fakeIssuerContext } from '../../fixtures/issuerContext';

describe('D1 public configuration projection and legacy fallback', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  const series = {
    listar: jest.fn(async () => [
      { document_type: '01', series: 'F001', is_active: true },
    ]),
  };
  const certificates = {
    getCertificate: jest.fn(() => ({
      validTo: new Date('2099-01-01'),
      daysRemaining: 10,
    })),
  };
  it('sanitizes URL credentials, query and fragment from the public projection', async () => {
    const context = fakeIssuerContext('a', {
      certificate: {
        base64: 'obviously-fake-p12',
        password: 'obviously-fake-cert-secret',
      },
      solSource: 'company',
      certificateSource: 'company',
      endpoint:
        'https://fake-user:fake-password@example.invalid/billService?token=fake-token#fake-fragment',
      consultEndpoint: 'invalid endpoint',
    });
    const config = new InvoiceConfigService(
      series as never,
      certificates as never,
      { resolve: async () => context } as never,
    );
    const result = await config.obtener('a');
    expect(result.endpoint_bill_service).toBe(
      'https://example.invalid/billService',
    );
    expect(result.endpoint_consult_service).toBe('(sin configurar)');
    expect(result).toMatchObject({
      origen_sol: 'company',
      origen_certificado: 'company',
      sol_password_configurada: true,
      cert_password_configurada: true,
    });
    expect(JSON.stringify(result)).not.toContain('obviously-fake');
    expect(JSON.stringify(result)).not.toContain('fake-password');
    expect(certificates.getCertificate).toHaveBeenLastCalledWith(context);
  });
  it.each(['PRODUCTION', 'PRODUCCION', 'BETA', 'MOCK', undefined])(
    'retains the legacy environment when no resolver is injected: %s',
    async (value) => {
      if (value === undefined) delete process.env.SUNAT_ENV;
      else process.env.SUNAT_ENV = value;
      delete process.env.SUNAT_BILL_SERVICE_URL;
      delete process.env.SUNAT_CONSULT_SERVICE_URL;
      delete process.env.SUNAT_SOL_USER;
      delete process.env.SUNAT_SOL_PASSWORD;
      delete process.env.CERT_PASSWORD;
      const result = await new InvoiceConfigService(
        series as never,
        certificates as never,
      ).obtener('a');
      expect(result.entorno).toBe(
        value?.startsWith('PROD')
          ? 'PRODUCCION'
          : value === 'BETA'
            ? 'BETA'
            : 'MOCK',
      );
      expect(result.sol_password_configurada).toBe(false);
      expect(result.cert_password_configurada).toBe(false);
      expect(result.endpoint_bill_service).toBe('(sin configurar)');
    },
  );
  it('derives consult URL from deployment bill URL and reports a missing SOL password', async () => {
    process.env.SUNAT_BILL_SERVICE_URL = 'http://127.0.0.1:1/billService';
    delete process.env.SUNAT_CONSULT_SERVICE_URL;
    process.env.SUNAT_SOL_USER = 'FAKE';
    delete process.env.SUNAT_SOL_PASSWORD;
    const result = await new InvoiceConfigService(
      series as never,
      certificates as never,
    ).obtener('a');
    expect(result.endpoint_consult_service).toBe(
      'http://127.0.0.1:1/billConsultService',
    );
    expect(
      result.checklist.find((point) => point.clave === 'usuario_sol')?.detalle,
    ).toBe('Falta SUNAT_SOL_PASSWORD');
  });
  it('sanitizes certificate errors and reports missing context groups without using deployment secrets', async () => {
    const context = fakeIssuerContext('a', { sol: null, certificate: null });
    const getCertificate = jest.fn(() => {
      throw new Error('obviously-fake-sensitive-parser-error');
    });
    const result = await new InvoiceConfigService(
      { listar: async () => [] } as never,
      { getCertificate } as never,
      { resolve: async () => context } as never,
    ).obtener('a');
    expect(result).toMatchObject({
      sol_password_configurada: false,
      cert_password_configurada: false,
      listo_para_emitir: false,
    });
    expect(JSON.stringify(result)).not.toContain(
      'obviously-fake-sensitive-parser-error',
    );
  });
  it('fails explicitly when persistence is unavailable or resolution fails', async () => {
    const service = new InvoiceConfigService(
      series as never,
      certificates as never,
    );
    await expect(service.actualizar('a', {})).rejects.toThrow(
      'ISSUER_CONFIG_WRITER_UNAVAILABLE',
    );
    const error = new Error('ISSUER_CONFIG_DECRYPTION_FAILED');
    const config = new InvoiceConfigService(
      series as never,
      certificates as never,
      {
        resolve: async () => {
          throw error;
        },
      } as never,
    );
    await expect(config.obtener('a')).rejects.toBe(error);
  });
});
