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
