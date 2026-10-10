/**
 * Genera un certificado digital de PRUEBA (PKCS#12 autofirmado).
 *
 * POR QUE ES UN SCRIPT Y NO UN ARCHIVO
 * Un .p12 con contrasena es una credencial, y el criterio 4 de TA-08 prohibe
 * versionar credenciales. Por eso el certificado se genera, no se commitea:
 * se escribe en fixtures/certs/, que esta en .gitignore.
 *
 * CUMPLE LAS 4 VALIDACIONES DE CertificateService (TA-04):
 *  1. Sale en Base64 listo para CERT_BASE64.
 *  2. El PKCS#12 contiene el par certificado + clave privada.
 *  3. Vigencia de 2 anos: no esta vencido ni proximo a vencer.
 *  4. El RUC va en el CN y el serialNumber del subject, asi que
 *     subjectString.includes(rucEmisor) es verdadero.
 *
 * Uso:
 *   npx ts-node scripts/sunat-fixtures/generar-certificado-prueba.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as forge from 'node-forge';

/** Datos ficticios: coinciden con el RUC del fixture de factura y de los CDR. */
const RUC_EMISOR = '20123456789';
const NOMBRE_EMPRESA = 'EMPRESA DE PRUEBA S.A.C.';
const CERT_PASSWORD = 'prueba-ta08';
const DIAS_VIGENCIA = 730; // 2 anos

const OUTPUT_DIR = join(process.cwd(), 'fixtures', 'certs');

export interface CertificadoPrueba {
  /** PKCS#12 en Base64: es el valor de CERT_BASE64. */
  certBase64: string;
  /** Contrasena del PKCS#12: es el valor de CERT_PASSWORD. */
  password: string;
  /** RUC del emisor: es el valor de RUC_EMISOR. */
  rucEmisor: string;
  /** El PKCS#12 binario, por si se necesita escribir el .p12. */
  p12Der: string;
}

/**
 * Genera el par de claves, el certificado autofirmado y lo empaqueta en
 * PKCS#12. Todo en memoria.
 */
export function generarCertificadoPrueba(): CertificadoPrueba {
  // 1. Par de claves RSA de 2048 bits.
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // 2. Certificado autofirmado.
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  // Numero de serie: puede ser cualquiera para un certificado de prueba.
  cert.serialNumber = '01';

  // Vigencia: desde ayer hasta dentro de 2 anos. Se empieza ayer para evitar
  // problemas de desfase de reloj entre la maquina que genera y la que valida.
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000);
  cert.validity.notBefore = desde;
  cert.validity.notAfter = hasta;

  // Subject: el RUC va en el CN y en el serialNumber.
  // CertificateService valida con subjectString.includes(rucEmisor), asi que
  // basta con que el RUC aparezca en cualquier atributo del subject.
  const attrs = [
    // El RUC va dentro del CN: CertificateService valida con
    // subjectString.includes(rucEmisor), asi que basta con que aparezca aqui.
    { name: 'commonName', value: `${NOMBRE_EMPRESA} - ${RUC_EMISOR}` },
    // Se usa 'name' (no 'shortName') porque node-forge no registra shortName
    // para organizationName ni countryName.
    { name: 'organizationName', value: NOMBRE_EMPRESA },
    { name: 'countryName', value: 'PE' },
  ];
  cert.setSubject(attrs);
  // Autofirmado: el emisor es el mismo sujeto.
  cert.setIssuer(attrs);

  // Extensiones minimas de un certificado X.509.
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', clientAuth: true },
  ]);

  // 3. Firmar el certificado con su propia clave privada (SHA-256).
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // 4. Empaquetar en PKCS#12 con una contrasena.
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    cert,
    CERT_PASSWORD,
    {
      algorithm: '3des',
    },
  );
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

  return {
    certBase64: forge.util.encode64(p12Der),
    password: CERT_PASSWORD,
    rucEmisor: RUC_EMISOR,
    p12Der,
  };
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const { certBase64, p12Der } = generarCertificadoPrueba();

  // El .p12 binario: esta en una carpeta ignorada, nunca se commitea.
  writeFileSync(
    join(OUTPUT_DIR, 'certificado-prueba.p12'),
    Buffer.from(p12Der, 'binary'),
  );
  // El Base64, para copiar a las variables de entorno.
  writeFileSync(join(OUTPUT_DIR, 'certificado-prueba.base64'), certBase64);

  console.log('Certificado de prueba generado.');
  console.log(`  RUC_EMISOR      = ${RUC_EMISOR}`);
  console.log(`  CERT_PASSWORD   = ${CERT_PASSWORD}`);
  console.log(
    `  CERT_BASE64     = (${certBase64.length} caracteres, en el archivo .base64)`,
  );
  console.log(`\nArchivos escritos en ${OUTPUT_DIR} (ignorados por git)`);
}

if (require.main === module) {
  main();
}
