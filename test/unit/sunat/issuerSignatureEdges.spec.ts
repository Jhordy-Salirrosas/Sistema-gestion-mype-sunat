import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SignedXml } from 'xml-crypto';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { fakeIssuerContext } from '../../fixtures/issuerContext';

describe('D1 company signature failure boundaries', () => {
  let fixture: ReturnType<typeof fakeIssuerCertificate>;
  beforeAll(() => {
    fixture = fakeIssuerCertificate();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const service = () =>
    new SignatureService({
      getCertificate: () => ({
        certificatePem: fixture.pem,
        privateKeyPem: fixture.privateKeyPem,
        issuerRuc: '20000000001',
      }),
    } as never);
  it.each(['', '   ', null])(
    'rejects empty XML before resolving any certificate: %j',
    (xml) => {
      const getCertificate = jest.fn();
      expect(() =>
        new SignatureService({ getCertificate } as never).signXml(
          xml as never,
          fakeIssuerContext(),
        ),
      ).toThrow(BadRequestException);
      expect(getCertificate).not.toHaveBeenCalled();
    },
  );
  it('signs with the company certificate when ExtensionContent uses an unqualified legacy namespace', () => {
    const signed = service().signXml(
      '<Invoice><ExtensionContent/></Invoice>',
      fakeIssuerContext(),
    );
    expect(signed.digestValue).toBeTruthy();
    expect(signed.signatureValue).toBeTruthy();
    expect(signed.signedXml).toContain('ds:Signature');
  });
  it('preserves a typed signing error from the cryptographic boundary', () => {
    const error = new BadRequestException('FAKE_SIGNING_REJECTION');
    jest
      .spyOn(SignedXml.prototype, 'computeSignature')
      .mockImplementation(() => {
        throw error;
      });
    expect(() => service().signXml('<Invoice/>', fakeIssuerContext())).toThrow(
      error,
    );
  });
  it.each([new Error('fake-crypto-error'), 'fake-crypto-rejection'])(
    'wraps unexpected crypto failures consistently: %s',
    (error) => {
      jest
        .spyOn(SignedXml.prototype, 'computeSignature')
        .mockImplementation(() => {
          throw error;
        });
      expect(() =>
        service().signXml('<Invoice/>', fakeIssuerContext()),
      ).toThrow(InternalServerErrorException);
    },
  );
  it('turns a non-Error certificate rejection into the explicit certificate failure', () => {
    expect(() =>
      new SignatureService({
        getCertificate: () => {
          throw 'fake-rejection';
        },
      } as never).signXml('<Invoice/>', fakeIssuerContext()),
    ).toThrow('ERR_CERT_INVALID');
  });
  it.each([
    '',
    null,
    12,
    '<Invoice/>',
    '<Signature/>',
    '<Signature xmlns:ds="urn:fake"><ds:DigestValue/><ds:SignatureValue>fake</ds:SignatureValue></Signature>',
    '<Signature xmlns:ds="urn:fake"><ds:DigestValue>fake</ds:DigestValue><ds:SignatureValue> </ds:SignatureValue></Signature>',
    '<bad',
  ])('rejects empty or incomplete signature structures: %j', (xml) => {
    expect(service().verifySignature(xml as never)).toBe(false);
  });
});
