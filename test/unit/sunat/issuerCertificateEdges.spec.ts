import { CertificateService } from '../../../src/modules/sunat/certificate.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { fakeIssuerContext } from '../../fixtures/issuerContext';
import * as forge from 'node-forge';

describe('D1 issuer certificate rejection and cache lifetime', () => {
  const env = { ...process.env };
  let fixture: ReturnType<typeof fakeIssuerCertificate>;
  beforeAll(() => {
    fixture = fakeIssuerCertificate();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...env };
  });
  it.each([
    {
      base64: '',
      password: 'fake',
      ruc: '20000000001',
      missing: 'CERT_BASE64',
    },
    {
      base64: 'ZmFrZQ==',
      password: '',
      ruc: '20000000001',
      missing: 'CERT_PASSWORD',
    },
    { base64: 'ZmFrZQ==', password: 'fake', ruc: '', missing: 'RUC_EMISOR' },
  ])(
    'requires certificate group member $missing',
    ({ base64, password, ruc, missing }) => {
      expect(() =>
        new CertificateService().validarYCargarCertificado(
          base64,
          password,
          ruc,
        ),
      ).toThrow(missing);
    },
  );
  it('rejects a certificate-only PKCS#12 without a private key', () => {
    expect(() =>
      new CertificateService().validarYCargarCertificado(
        fixture.p12(null),
        'obviously-fake-password',
        '20000000001',
      ),
    ).toThrow('clave privada');
  });
  it('rejects a private key unrelated to the certificate', () => {
    const unrelated = forge.pki.rsa.generateKeyPair(1024).privateKey;
    expect(() =>
      new CertificateService().validarYCargarCertificado(
        fixture.p12(unrelated),
        'obviously-fake-password',
        '20000000001',
      ),
    ).toThrow('par de certificado');
  });
  it('sanitizes invalid PKCS#12 parser failures', () => {
    expect(() =>
      new CertificateService().validarYCargarCertificado(
        'ZmFrZQ==',
        'obviously-fake-password',
        '20000000001',
      ),
    ).toThrow(/^Contraseña inválida o formato PKCS#12 corrupto$/);
  });
  it('reloads an expired cached certificate rather than returning it', () => {
    const service = new CertificateService();
    const cert = {
      certificatePem: fixture.pem,
      privateKeyPem: fixture.privateKeyPem,
      issuerRuc: '20000000001',
      validFrom: new Date(Date.now() - 1000),
      validTo: new Date(Date.now() + 1000),
      daysRemaining: 1,
    };
    const load = jest
      .spyOn(service, 'validarYCargarCertificado')
      .mockReturnValue(cert);
    const context = fakeIssuerContext('a', {
      certificate: { base64: 'fake-p12', password: 'fake-password' },
    });
    service.getCertificate(context);
    cert.validTo = new Date(Date.now() - 1);
    service.getCertificate(context);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('reloads a cached certificate whose validity starts in the future', () => {
    const service = new CertificateService();
    const cert = {
      certificatePem: fixture.pem,
      privateKeyPem: fixture.privateKeyPem,
      issuerRuc: '20000000001',
      validFrom: new Date(Date.now() - 1000),
      validTo: new Date(Date.now() + 86400000),
      daysRemaining: 1,
    };
    const load = jest
      .spyOn(service, 'validarYCargarCertificado')
      .mockReturnValue(cert);
    const context = fakeIssuerContext('a', {
      certificate: { base64: 'fake', password: 'fake' },
    });
    service.getCertificate(context);
    cert.validFrom = new Date(Date.now() + 86400000);
    service.getCertificate(context);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('bounds the company cache and reloads evicted entries', () => {
    const service = new CertificateService();
    const load = jest
      .spyOn(service, 'validarYCargarCertificado')
      .mockReturnValue({
        certificatePem: fixture.pem,
        privateKeyPem: fixture.privateKeyPem,
        issuerRuc: '20000000001',
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 86400000),
        daysRemaining: 1,
      });
    const certificate = { base64: 'fake', password: 'fake' };
    for (let i = 0; i <= 100; i++)
      service.getCertificate(fakeIssuerContext('fake-' + i, { certificate }));
    service.getCertificate(fakeIssuerContext('fake-0', { certificate }));
    expect(load).toHaveBeenCalledTimes(102);
  });
  it('rejects a future certificate even when its key and issuer match', () => {
    const future = fakeIssuerCertificate();
    future.cert.validity.notBefore = new Date(Date.now() + 86400000);
    future.cert.validity.notAfter = new Date(Date.now() + 172800000);
    future.cert.sign(future.keys.privateKey, forge.md.sha256.create());
    expect(() =>
      new CertificateService().validarYCargarCertificado(
        future.p12(),
        'obviously-fake-password',
        '20000000001',
      ),
    ).toThrow('no vigente');
  });
});

it('inspecciona un certificado vencido sin habilitarlo para firmar ni devolver su clave privada', () => {
  const fixture = fakeIssuerCertificate();
  fixture.cert.validity.notBefore = new Date(Date.now() - 10 * 86400000);
  fixture.cert.validity.notAfter = new Date(Date.now() - 2 * 86400000);
  fixture.cert.sign(fixture.keys.privateKey, forge.md.sha256.create());
  const service = new CertificateService();
  const context = fakeIssuerContext('empresa', { certificate: { base64: fixture.p12(), password: 'obviously-fake-password' } });
  const metadata = service.inspectCertificate(context);
  expect(metadata.validTo.getTime()).toBeLessThan(Date.now());
  expect(metadata.daysRemaining).toBe(-2);
  expect(JSON.stringify(metadata)).not.toContain('PRIVATE KEY');
  expect(metadata).not.toHaveProperty('privateKeyPem');
  expect(() => service.getCertificate(context)).toThrow(/vencido|vigente/);
});

it('inspecciona el certificado de despliegue y conserva fechas sin publicar clave privada', () => {
  const env = { ...process.env };
  try {
    const fixture = fakeIssuerCertificate();
    process.env.CERT_BASE64 = fixture.p12();
    process.env.CERT_PASSWORD = 'obviously-fake-password';
    process.env.RUC_EMISOR = '20000000001';
    const s = new CertificateService();
    expect(s.inspectCertificate()).toMatchObject({ issuerRuc: '20000000001', daysRemaining: 1 });
    expect(() => s.inspectCertificate(fakeIssuerContext('empresa', { certificate: null }))).toThrow('CERT_BASE64');
    delete process.env.CERT_PASSWORD;
    expect(() => s.inspectCertificate()).toThrow('CERT_PASSWORD');
    delete process.env.CERT_BASE64;
    expect(() => s.inspectCertificate()).toThrow('CERT_BASE64');
  } finally { process.env = env; }
});
