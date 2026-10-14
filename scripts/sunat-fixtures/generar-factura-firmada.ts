/**
 * Firma la factura UBL 2.1 con el certificado de prueba y produce el fixture
 * factura-ubl21-firmada.xml.
 *
 * DETERMINISTA: reutiliza el certificado persistido en fixtures/certs/ en lugar
 * de generar uno nuevo. RSA produce una firma distinta con cada par de claves,
 * asi que generar un certificado nuevo en cada corrida haria que el XML firmado
 * cambiara siempre, produciendo un diff de una linea sin cambios reales.
 *
 * Requiere haber ejecutado antes generar-certificado-prueba.ts. El orden del
 * pipeline es: certificado -> factura firmada.
 *
 * Usa los MISMOS parametros que SignatureService (TA-07):
 *  - Canonicalizacion: c14n
 *  - Firma: rsa-sha256
 *  - Digest: sha256
 *  - Transformacion: enveloped-signature
 *  - El Signature se inserta dentro de ext:ExtensionContent
 *
 * API de xml-crypto v6 (verificada en sus tipos, NO en la v2/v3):
 *  - privateKey y publicCert van en el CONSTRUCTOR, no como propiedades.
 *  - La ubicacion se pasa como XPath en location.reference, no como nodo.
 *  - getSignedXml() devuelve el documento CON la firma ya insertada.
 *  - El nodo se emite sin prefijo ds:, con el namespace xmldsig por defecto.
 *
 * Uso:
 *   npx ts-node scripts/sunat-fixtures/generar-certificado-prueba.ts
 *   npx ts-node scripts/sunat-fixtures/generar-factura-firmada.ts
 */
import { X509Certificate } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignedXml } from 'xml-crypto';
import { CertificateService } from '../../src/modules/sunat/certificate.service';
import {
  CERT_PASSWORD,
  OUTPUT_DIR as CERT_OUTPUT_DIR,
  RUC_EMISOR,
} from './generar-certificado-prueba';

export const INVOICE_DIR = join(process.cwd(), 'fixtures', 'sunat-invoice');
export const INVOICE_PATH = join(INVOICE_DIR, 'factura-ubl21.xml');
export const OUTPUT_PATH = join(INVOICE_DIR, 'factura-ubl21-firmada.xml');

/**
 * Ruta del certificado persistido. Lo escribe generar-certificado-prueba.ts.
 */
export const CERT_BASE64_PATH = join(
  CERT_OUTPUT_DIR,
  'certificado-prueba.base64',
);

/** Parametros de firma de SUNAT, identicos a los de SignatureService. */
const CANONICALIZATION = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const SIGNATURE_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
const TRANSFORM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Quita las cabeceras y los saltos de linea del PEM para dejar solo el Base64
 * del certificado. Es lo que espera el nodo X509Certificate.
 */
export function certificadoABase64(certificatePem: string): string {
  return certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

/**
 * Firma el XML y devuelve el documento completo con la firma dentro de
 * ext:ExtensionContent.
 */
export function firmar(
  xmlSinFirmar: string,
  privateKeyPem: string,
  certificatePem: string,
): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    // publicCert hace que el KeyInfo incluya el X509Certificate, que SUNAT
    // necesita para verificar la firma. Sin esto, getKeyInfoContent devuelve
    // null y la firma queda sin certificado embebido.
    publicCert: new X509Certificate(certificatePem).toString(),
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    canonicalizationAlgorithm: CANONICALIZATION,
  });

  // Referencia al documento completo con transformacion enveloped.
  // isEmptyUri: true equivale a URI="" (firmar todo el documento).
  sig.addReference({
    xpath: '/*',
    digestAlgorithm: DIGEST_ALGORITHM,
    transforms: [TRANSFORM],
    isEmptyUri: true,
  });

  // La ubicacion es un XPATH, no un nodo: xml-crypto v6 cambio la API.
  sig.computeSignature(xmlSinFirmar, {
    location: {
      reference: "//*[local-name(.)='ExtensionContent']",
      action: 'append',
    },
  });

  // getSignedXml() devuelve el documento original CON la firma insertada.
  return sig.getSignedXml();
}

/**
 * Genera la factura firmada y la escribe en el fixture.
 *
 * Reutiliza el certificado persistido: es lo que hace determinista al pipeline.
 * Si el certificado no existe, hay que generarlo primero.
 */
export function generarFacturaFirmada(): {
  ruta: string;
  xml: string;
} {
  if (!existsSync(CERT_BASE64_PATH)) {
    throw new Error(
      `No se encontro el certificado en ${CERT_BASE64_PATH}. ` +
        'Ejecuta primero: npx ts-node scripts/sunat-fixtures/generar-certificado-prueba.ts',
    );
  }

  // Se REUTILIZA el certificado persistido en lugar de generar uno nuevo.
  // Es lo que evita que el XML firmado cambie en cada corrida.
  const certBase64 = readFileSync(CERT_BASE64_PATH, 'utf8').trim();
  const service = new CertificateService();
  const cert = service.validarYCargarCertificado(
    certBase64,
    CERT_PASSWORD,
    RUC_EMISOR,
  );

  const xmlSinFirmar = readFileSync(INVOICE_PATH, 'utf8');
  const xmlFirmado = firmar(
    xmlSinFirmar,
    cert.privateKeyPem,
    cert.certificatePem,
  );

  mkdirSync(INVOICE_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, xmlFirmado);

  return { ruta: OUTPUT_PATH, xml: xmlFirmado };
}

function main() {
  const { ruta, xml } = generarFacturaFirmada();

  console.log('Factura firmada generada.');
  console.log('  Certificado      :', CERT_BASE64_PATH);
  console.log('  Entrada          :', INVOICE_PATH);
  console.log('  Salida           :', ruta);
  console.log('  Tamano           :', xml.length, 'caracteres');
  console.log(
    '  Signature        :',
    xml.includes('Signature') ? 'presente' : 'FALTA',
  );
  console.log(
    '  X509Certificate  :',
    xml.includes('X509Certificate') ? 'incluido en el KeyInfo' : 'FALTA',
  );
}

// Solo se ejecuta cuando se invoca el script directamente, no al importarlo
// desde una prueba. Sin esta guarda, importar el modulo escribiria archivos.
if (require.main === module) {
  main();
}
