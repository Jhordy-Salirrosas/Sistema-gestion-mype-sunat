const forge = require('node-forge');

console.log('Generando certificado PKCS#12 falso para entorno de desarrollo...');

const ruc = '20601234567';
const password = 'micontraseñasegura';

// Generar par de claves RSA
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
  { name: 'commonName', value: 'Empresa Falsa MYPE' },
  { name: 'countryName', value: 'PE' },
  { shortName: 'ST', value: 'Lima' },
  { name: 'localityName', value: 'Lima' },
  { name: 'organizationName', value: 'Test Org' },
  { shortName: 'OU', value: 'Test Unit' },
  // Agregamos el RUC explícitamente para que el CertificateService lo encuentre y haga match
  { name: 'description', value: ruc } 
];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

// Empaquetar como PKCS#12 protegido con la contraseña
const newPkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  [cert],
  password,
  { generateLocalKeyId: true, friendlyName: 'cert' }
);

// Convertir a binario DER y luego a cadena de texto Base64
const newPkcs12Der = forge.asn1.toDer(newPkcs12Asn1).getBytes();
const base64 = forge.util.encode64(newPkcs12Der);

console.log('\n✅ Certificado generado con éxito.\n');
console.log('Copia estos valores exactos y pégalos en tu archivo .env:\n');
console.log(`CERT_PASSWORD="${password}"`);
console.log(`CERT_BASE64="${base64}"\n`);
