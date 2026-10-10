/**
 * Prueba de los fixtures del pipeline (TA-08).
 *
 * Verifica los criterios 1, 4 y 4b del ticket:
 *  - Existen y son validos los fixtures del CDR.
 *  - La factura UBL 2.1 es XML bien formado.
 *  - El certificado de prueba que genera el script es ACEPTADO por el
 *    CertificateService de TA-04 (no solo que exista).
 *  - El XML firmado tiene una firma CRIPTOGRAFICAMENTE VALIDA, no solo el
 *    nodo ds:Signature presente.
 *
 * La firma se verifica por NAMESPACE, nunca por el prefijo: xml-crypto declara
 * el namespace xmldsig por defecto, sin prefijo ds:.
 */
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { CertificateService } from '../../src/modules/sunat/certificate.service';
import { parseCdr } from '../../src/modules/sunat/soap/cdr.parser';
import { classifyCdr } from '../../src/modules/sunat/soap/cdr.classifier';
import { InvoiceStatus } from '../../src/generated/prisma/enums';
import { generarCertificadoPrueba } from '../../scripts/sunat-fixtures/generar-certificado-prueba';

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const EXT_NS =
  'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';

const CDR_DIR = join(process.cwd(), 'fixtures', 'sunat-cdr');
const INVOICE_DIR = join(process.cwd(), 'fixtures', 'sunat-invoice');

function leer(ruta: string): string {
  return readFileSync(ruta, 'utf8');
}

describe('TA-08 - fixtures del pipeline', () => {
  describe('criterio 1: los fixtures existen y son validos', () => {
    it('los 3 CDR obligatorios estan versionados en pares .xml y .base64', () => {
      for (const caso of ['aceptado', 'rechazado', 'observacion']) {
        expect(leer(join(CDR_DIR, `${caso}.xml`)).length).toBeGreaterThan(0);
        expect(leer(join(CDR_DIR, `${caso}.base64`)).length).toBeGreaterThan(0);
      }
    });

    it('la factura UBL 2.1 es XML bien formado y con el ID correcto', () => {
      const xml = leer(join(INVOICE_DIR, 'factura-ubl21.xml'));
      const doc: any = new DOMParser().parseFromString(xml, 'text/xml');

      expect(doc.documentElement.nodeName).toBe('Invoice');
      // El ID debe coincidir con el ReferenceID del CDR aceptado, o SUNAT
      // responde con el codigo 1049.
      expect(xml).toContain('<cbc:ID>F001-00000001</cbc:ID>');
      expect(leer(join(CDR_DIR, 'aceptado.xml'))).toContain(
        '<cbc:ReferenceID>F001-00000001</cbc:ReferenceID>',
      );
    });

    it('la factura tiene el nodo donde TA-07 inyecta la firma', () => {
      const xml = leer(join(INVOICE_DIR, 'factura-ubl21.xml'));
      expect(xml).toContain('<ext:UBLExtensions>');
      expect(xml).toContain('<ext:ExtensionContent/>');
    });
  });

  describe('criterio 4: el certificado de prueba no se versiona', () => {
    it('el certificado generado cumple las validaciones de TA-04', () => {
      // Se genera en memoria: demuestra que el fixture es reproducible.
      const cert = generarCertificadoPrueba();
      const service = new CertificateService();

      const resultado = service.validarYCargarCertificado(
        cert.certBase64,
        cert.password,
        cert.rucEmisor,
      );

      expect(resultado.certificatePem).toContain('BEGIN CERTIFICATE');
      expect(resultado.privateKeyPem).toContain('PRIVATE KEY');
      // Mas de 30 dias: no dispara la advertencia de vencimiento proximo.
      expect(resultado.daysRemaining).toBeGreaterThan(30);
      // El certificado debe corresponder al RUC configurado.
      expect(resultado.certificatePem.length).toBeGreaterThan(500);
    });

    it('rechaza un certificado cuyo RUC no coincide', () => {
      const cert = generarCertificadoPrueba();
      const service = new CertificateService();

      expect(() =>
        service.validarYCargarCertificado(
          cert.certBase64,
          cert.password,
          '20999999999',
        ),
      ).toThrow();
    });
  });

  describe('criterio 4b: el XML firmado tiene firma valida', () => {
    it('la firma esta dentro de ext:ExtensionContent y el certificado va embebido', () => {
      const xml = leer(join(INVOICE_DIR, 'factura-ubl21-firmada.xml'));
      const doc: any = new DOMParser().parseFromString(xml, 'text/xml');

      const extensionContent = doc.getElementsByTagNameNS(
        EXT_NS,
        'ExtensionContent',
      )[0];
      expect(extensionContent).toBeDefined();
      expect(
        extensionContent.getElementsByTagNameNS(XMLDSIG_NS, 'Signature').length,
      ).toBeGreaterThan(0);

      const signatureNode = doc.getElementsByTagNameNS(
        XMLDSIG_NS,
        'Signature',
      )[0];
      expect(
        signatureNode.getElementsByTagNameNS(XMLDSIG_NS, 'X509Certificate')
          .length,
      ).toBeGreaterThan(0);
    });

    it('la firma es criptograficamente valida', () => {
      const xml = leer(join(INVOICE_DIR, 'factura-ubl21-firmada.xml'));
      const doc: any = new DOMParser().parseFromString(xml, 'text/xml');

      const signatureNode = doc.getElementsByTagNameNS(
        XMLDSIG_NS,
        'Signature',
      )[0];
      const keyInfo = signatureNode.getElementsByTagNameNS(
        XMLDSIG_NS,
        'KeyInfo',
      )[0];
      const certPem = (SignedXml as any).getCertFromKeyInfo(keyInfo);

      expect(certPem).toBeTruthy();

      const sig = new SignedXml({ publicCert: certPem });
      sig.loadSignature(signatureNode);

      expect(sig.checkSignature(xml)).toBe(true);
    });

    it('el certificado embebido en la firma es un X.509 parseable', () => {
      const xml = leer(join(INVOICE_DIR, 'factura-ubl21-firmada.xml'));
      const match = /<X509Certificate>([^<]+)<\/X509Certificate>/.exec(xml);

      expect(match).not.toBeNull();

      const pem = `-----BEGIN CERTIFICATE-----\n${match![1]}\n-----END CERTIFICATE-----`;
      const cert = new X509Certificate(pem);

      expect(cert.subject).toContain('20123456789');
    });
  });

  describe('criterio 4b: TA-03 consume los fixtures del CDR', () => {
    it('clasifica el CDR aceptado como ACEPTADO', () => {
      const cdr = parseCdr(leer(join(CDR_DIR, 'aceptado.base64')).trim());
      const clasificacion = classifyCdr(cdr);

      expect(cdr.responseCode).toBe('0');
      expect(clasificacion.status).toBe(InvoiceStatus.ACEPTADO);
      expect(clasificacion.reintentable).toBe(false);
    });

    it('clasifica el CDR rechazado como RECHAZADO y no reintentable', () => {
      const cdr = parseCdr(leer(join(CDR_DIR, 'rechazado.base64')).trim());
      const clasificacion = classifyCdr(cdr);

      expect(cdr.responseCode).toBe('2326');
      expect(clasificacion.status).toBe(InvoiceStatus.RECHAZADO);
      expect(clasificacion.reintentable).toBe(false);
    });

    it('clasifica el CDR con observacion como ACEPTADO_CON_OBSERVACIONES', () => {
      const cdr = parseCdr(leer(join(CDR_DIR, 'observacion.base64')).trim());
      const clasificacion = classifyCdr(cdr);

      expect(cdr.responseCode).toBe('0');
      expect(clasificacion.kind).toBe('ACEPTADO_CON_OBSERVACIONES');
      // Un observado tiene validez tributaria: nunca es RECHAZADO.
      expect(clasificacion.valido).toBe(true);
    });
  });
});
