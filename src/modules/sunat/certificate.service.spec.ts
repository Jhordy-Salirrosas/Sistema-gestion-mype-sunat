import { Test, TestingModule } from '@nestjs/testing';
import { CertificateService } from './certificate.service';
import { BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';

describe('CertificateService (TT-04)', () => {
  let service: CertificateService;

  // Generador en memoria de certificados PKCS#12 para pruebas automatizadas
  function generateTestP12Base64(
    rucSubject: string,
    isExpired: boolean,
    daysValid = 365,
    password = 'password123',
  ): string {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(1024);
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';

    const now = new Date();
    if (isExpired) {
      cert.validity.notBefore = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      cert.validity.notAfter = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    } else {
      cert.validity.notBefore = now;
      cert.validity.notAfter = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);
    }

    const attrs = [
      { name: 'commonName', value: `RUC ${rucSubject} - MYPE TEST SAC` },
      { name: 'organizationName', value: 'MYPE CONFECCIONES SAC' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
      generateLocalKeyId: true,
      friendlyName: 'cert-test',
    });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    return Buffer.from(p12Der, 'binary').toString('base64');
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificateService],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
  });

  it('debe inicializarse correctamente', () => {
    expect(service).toBeDefined();
  });

  it('Criterio Exito: debe validar y cargar un certificado vigente con RUC correcto', () => {
    const ruc = '20601234567';
    const certBase64 = generateTestP12Base64(ruc, false, 90, 'secret123');

    const result = service.validarYCargarCertificado(certBase64, 'secret123', ruc);

    expect(result).toBeDefined();
    expect(result.issuerRuc).toBe(ruc);
    expect(result.certificatePem).toContain('BEGIN CERTIFICATE');
    expect(result.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
    expect(result.daysRemaining).toBeGreaterThan(30);
  });

  it('Criterio Advertencia: debe emitir alerta si vence en menos de 30 dias', () => {
    const ruc = '20601234567';
    const certBase64 = generateTestP12Base64(ruc, false, 15, 'secret123');

    const result = service.validarYCargarCertificado(certBase64, 'secret123', ruc);
    expect(result.daysRemaining).toBeLessThanOrEqual(30);
  });

  it('Criterio Rechazo 1: debe lanzar BadRequestException si el certificado esta VENCIDO', () => {
    const ruc = '20601234567';
    const certVencido = generateTestP12Base64(ruc, true, 0, 'secret123');

    expect(() => {
      service.validarYCargarCertificado(certVencido, 'secret123', ruc);
    }).toThrow(BadRequestException);
  });

  it('Criterio Rechazo 2: debe lanzar BadRequestException si el RUC emisor no coincide', () => {
    const rucConfigurado = '20601234567';
    const rucDistintoEnCert = '20999999999';
    const certConOtroRuc = generateTestP12Base64(rucDistintoEnCert, false, 180, 'secret123');

    expect(() => {
      service.validarYCargarCertificado(certConOtroRuc, 'secret123', rucConfigurado);
    }).toThrow(BadRequestException);
  });
});