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
 *  4. El RUC va en el CN del subject, asi que subjectString.includes(rucEmisor)
 *     es verdadero.
 *
 * ORDEN DEL PIPELINE
 * Este script va PRIMERO: genera el certificado que despues consume
 * generar-factura-firmada.ts. Ese orden es lo que hace determinista al
 * pipeline, porque RSA produce una firma distinta con cada par de claves.
 *
 * Uso:
 *   npx ts-node scripts/sunat-fixtures/generar-certificado-prueba.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as forge from 'node-forge';

/** Datos ficticios: coinciden con el RUC del fixture de factura y de los CDR. */
export const RUC_EMISOR = '20123456789';
export const NOMBRE_EMPRESA = 'EMPRESA DE PRUEBA S.A.C.';
export const CERT_PASSWORD = 'prueba-ta08';
export const DIAS_VIGENCIA = 730; // 2 anos

/**
 * Carpeta de salida. Esta ignorada por git (fixtures/certs/.gitignore), asi que
 * el certificado nunca se versiona.
 */
export const OUTPUT_DIR = join(process.cwd(), 'fixtures', 'certs');

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
 *
 * Es una funcion pura respecto al disco: no escribe nada. Por eso la puede usar
 * tanto el script (que luego escribe los archivos) como la prueba automatizada
 * (que solo la necesita en memoria).
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

  // Subject: el RUC va dentro del CN.
  // CertificateService valida con subjectString.includes(rucEmisor), asi que
  // basta con que el RUC aparezca en cualquier atributo del subject.
  //
  // OJO: se usa 'name' con el nombre completo, no 'shortName'. node-forge no
  // registra shortName para serialNumber, organizationName ni countryName, y
  // lanza "Attribute type not specified" si se intenta.
  const attrs = [
    { name: 'commonName', value: `${NOMBRE_EMPRESA} - ${RUC_EMISOR}` },
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
    { algorithm: '3des' },
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
  const p12Path = join(OUTPUT_DIR, 'certificado-prueba.p12');
  const base64Path = join(OUTPUT_DIR, 'certificado-prueba.base64');

  // IDEMPOTENCIA: si el certificado ya existe, se reutiliza.
  // Es lo que hace determinista al pipeline: RSA produce una firma distinta
  // con cada par de claves, asi que regenerar el certificado en cada corrida
  // cambiaria el XML firmado sin que haya ningun cambio real.
  if (existsSync(base64Path)) {
    const certBase64 = readFileSync(base64Path, 'utf8').trim();
    console.log('El certificado de prueba ya existe: se reutiliza.');
    console.log(`  RUC_EMISOR      = ${RUC_EMISOR}`);
    console.log(`  CERT_PASSWORD   = ${CERT_PASSWORD}`);
    console.log(
      `  CERT_BASE64     = (${certBase64.length} caracteres, sin cambios)`,
    );
    console.log(`\nArchivo: ${base64Path}`);
    console.log(
      'Para forzar la regeneracion, borra fixtures/certs/ y vuelve a ejecutar.',
    );
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const { certBase64, p12Der } = generarCertificadoPrueba();

  // El .p12 binario: esta en una carpeta ignorada, nunca se commitea.
  writeFileSync(p12Path, Buffer.from(p12Der, 'binary'));
  // El Base64, que es lo que consume generar-factura-firmada.ts y lo que se
  // copia a la variable de entorno CERT_BASE64.
  writeFileSync(base64Path, certBase64);

  console.log('Certificado de prueba generado.');
  console.log(`  RUC_EMISOR      = ${RUC_EMISOR}`);
  console.log(`  CERT_PASSWORD   = ${CERT_PASSWORD}`);
  console.log(
    `  CERT_BASE64     = (${certBase64.length} caracteres, en el archivo .base64)`,
  );
  console.log(`\nArchivos escritos en ${OUTPUT_DIR} (ignorados por git)`);
}

// Solo se ejecuta cuando se invoca el script directamente, no al importarlo
// desde una prueba o desde otro script. Sin esta guarda, importar el modulo
// regeneraria el certificado como efecto secundario.
if (require.main === module) {
  main();
}
