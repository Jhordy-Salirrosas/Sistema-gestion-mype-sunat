import { Test, TestingModule } from '@nestjs/testing';
import { SignatureService } from './signature.service';
import { CertificateService } from './certificate.service';
import { BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';

describe('SignatureService (TT-07)', () => {
  let service: SignatureService;
  let certificateService: CertificateService;

  let testCertPem: string;
  let testKeyPem: string;

  // Generador en memoria de llaves RSA y certificado X.509
  beforeAll(() => {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(1024);
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const attrs = [
      { name: 'commonName', value: '20601234567 - MYPE CONFECCIONES SAC' },
      { name: 'organizationName', value: 'MYPE CONFECCIONES SAC' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    testCertPem = pki.certificateToPem(cert);
    testKeyPem = pki.privateKeyToPem(keys.privateKey);
  });

  // XML Fixture oficial del pipeline (Factura F001-00000001)
  const fixtureXmlInvoice = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>F001-00000001</cbc:ID>
  <cbc:IssueDate>2026-10-07</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">20601234567</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>MYPE CONFECCIONES SAC</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="PEN">500.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

  beforeEach(async () => {
    const mockCertService = {
      getCertificate: jest.fn().mockReturnValue({
        certificatePem: testCertPem,
        privateKeyPem: testKeyPem,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        issuerRuc: '20601234567',
        daysRemaining: 365,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        {
          provide: CertificateService,
          useValue: mockCertService,
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
    certificateService = module.get<CertificateService>(CertificateService);
  });

  it('debe inicializarse correctamente con dependencias inyectadas', () => {
    expect(service).toBeDefined();
    expect(certificateService).toBeDefined();
  });

  it('Criterio 1: debe firmar el XML anadiendo nodo ds:Signature con digest SHA-256 y KeyInfo', () => {
    const result = service.signXml(fixtureXmlInvoice);

    expect(result).toBeDefined();
    expect(result.signedXml).toContain('<ds:Signature');
    expect(result.signedXml).toContain('<ds:DigestValue>');
    expect(result.signedXml).toContain('<ds:SignatureValue>');
    expect(result.signedXml).toContain('<ds:X509Certificate>');
    expect(result.digestValue).toBeTruthy();
    expect(result.signatureValue).toBeTruthy();
  });

  it('Criterio 2: la firma debe ser verificable por un validador independiente (checkSignature)', () => {
    const { signedXml } = service.signXml(fixtureXmlInvoice);
    const isValid = service.verifySignature(signedXml);

    expect(isValid).toBe(true);
  });

  it('Criterio 3: el XML firmado debe conservar la estructura e identificadores UBL 2.1', () => {
    const { signedXml } = service.signXml(fixtureXmlInvoice);

    expect(signedXml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(signedXml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(signedXml).toContain('<cbc:ID>F001-00000001</cbc:ID>');
    expect(signedXml).toContain('MYPE CONFECCIONES SAC');
  });

  it('Criterio 4: debe fallar con codigo explicito si el certificado esta vencido o ausente', () => {
    jest.spyOn(certificateService, 'getCertificate').mockImplementation(() => {
      throw new BadRequestException('El certificado digital esta vencido');
    });

    expect(() => {
      service.signXml(fixtureXmlInvoice);
    }).toThrow(BadRequestException);
  });

  it('Criterio 5: debe construir e inyectar el nodo ExtensionContent si el XML base no lo incluye', () => {
    const xmlSinExtension = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>B001-00000001</cbc:ID></Invoice>`;

    const result = service.signXml(xmlSinExtension);
    expect(result.signedXml).toContain('ext:UBLExtensions');
    expect(result.signedXml).toContain('ext:ExtensionContent');
    expect(result.signedXml).toContain('ds:Signature');
  });
});