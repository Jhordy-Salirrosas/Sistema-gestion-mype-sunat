import * as forge from 'node-forge';
/** Self-signed and deliberately false; never trusted or used outside tests. */
export function fakeIssuerCertificate(ruc = '20000000001') {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 10000);
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  cert.setSubject([
    { name: 'commonName', value: `Obviously Fake Issuer ${ruc}` },
  ]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    keys,
    cert,
    pem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    p12: (privateKey: forge.pki.PrivateKey | null = keys.privateKey) =>
      forge.util.encode64(
        forge.asn1
          .toDer(
            forge.pkcs12.toPkcs12Asn1(
              privateKey!,
              [cert],
              'obviously-fake-password',
            ),
          )
          .getBytes(),
      ),
  };
}
