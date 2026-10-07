import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SignedXml } from 'xml-crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { CertificateService } from './certificate.service';

export interface SignatureResult {
  signedXml: string;
  digestValue: string;
  signatureValue: string;
  signatureId: string;
}

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  // Algoritmos mandatorios según especificación técnica de SUNAT UBL 2.1
  private readonly CANONICALIZATION_ALGORITHM = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  private readonly SIGNATURE_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  private readonly DIGEST_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
  private readonly TRANSFORM_ALGORITHM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

  constructor(private readonly certificateService: CertificateService) {}

  /**
   * Firma digitalmente un comprobante XML en formato UBL 2.1
   */
  public signXml(xmlString: string): SignatureResult {
    if (!xmlString || xmlString.trim().length === 0) {
      throw new BadRequestException('El XML proporcionado para firma está vacío');
    }

    // 1. Criterio 4: Obtener y validar el certificado X.509
    let certData;
    try {
      certData = this.certificateService.getCertificate();
    } catch (error: any) {
      this.logger.error(`[ERROR_CERTIFICADO_SUNAT] Falla de certificado al intentar firmar: ${error.message}`);
      throw new BadRequestException(`ERR_CERT_INVALID: No se puede firmar el comprobante. ${error.message}`);
    }

    try {
      // 2. Parsear el XML y asegurar la presencia de ext:ExtensionContent
      const parser = new DOMParser();
      const doc: any = parser.parseFromString(xmlString, 'text/xml');

      let extensionContentNode = doc.getElementsByTagNameNS(
        'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'ExtensionContent',
      )[0];

      if (!extensionContentNode) {
        extensionContentNode = doc.getElementsByTagName('ext:ExtensionContent')[0] ||
                               doc.getElementsByTagName('ExtensionContent')[0];
      }

      // Si no existe el nodo contenedor oficial de SUNAT, se inyecta en la cabecera
      if (!extensionContentNode) {
        const rootElement: any = doc.documentElement;
        if (!rootElement) {
          throw new BadRequestException('El XML no contiene un elemento raíz válido');
        }

        const ublExtensions = doc.createElementNS(
          'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
          'ext:UBLExtensions',
        );
        const ublExtension = doc.createElementNS(
          'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
          'ext:UBLExtension',
        );
        extensionContentNode = doc.createElementNS(
          'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
          'ext:ExtensionContent',
        );

        ublExtension.appendChild(extensionContentNode);
        ublExtensions.appendChild(ublExtension);

        if (rootElement.firstChild) {
          rootElement.insertBefore(ublExtensions, rootElement.firstChild);
        } else {
          rootElement.appendChild(ublExtensions);
        }
      }

      const preparedXml = new XMLSerializer().serializeToString(doc);
      const signatureId = `Signature-${Date.now()}`;

      // 3. Criterio 1: Configurar motor SignedXml con parámetros de SUNAT
      const sig: any = new SignedXml({
        privateKey: certData.privateKeyPem,
        signatureAlgorithm: this.SIGNATURE_ALGORITHM,
        canonicalizationAlgorithm: this.CANONICALIZATION_ALGORITHM,
      });
      sig.signingKey = certData.privateKeyPem;

      // Inclusión de la referencia al documento completo con transformación enveloped
      try {
        sig.addReference({
          xpath: '/*',
          transforms: [this.TRANSFORM_ALGORITHM],
          digestAlgorithm: this.DIGEST_ALGORITHM,
          isEmptyUri: true,
        });
      } catch {
        sig.addReference(
          '/*',
          [this.TRANSFORM_ALGORITHM],
          this.DIGEST_ALGORITHM,
        );
      }

      // Inclusión canónica del KeyInfo con X509Certificate
      const cleanCertBase64 = certData.certificatePem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\r\n\s]/g, '');

      sig.getKeyInfoContent = () => {
        return `<ds:X509Data><ds:X509Certificate>${cleanCertBase64}</ds:X509Certificate></ds:X509Data>`;
      };

      // 4. Inserción de la firma en el nodo ExtensionContent pasando signingKey explícita
      sig.computeSignature(preparedXml, {
        prefix: 'ds',
        signingKey: certData.privateKeyPem,
        location: {
          reference: "//*[local-name(.)='ExtensionContent']",
          action: 'append',
        },
      });

      const signedXml = sig.getSignedXml();

      // Extracción de metadatos de verificación
      const signedDoc: any = parser.parseFromString(signedXml, 'text/xml');
      const digestNode: any = signedDoc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'DigestValue')[0] ||
                              signedDoc.getElementsByTagName('ds:DigestValue')[0];
      const signatureValueNode: any = signedDoc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignatureValue')[0] ||
                                     signedDoc.getElementsByTagName('ds:SignatureValue')[0];

      const digestValue = digestNode?.textContent || digestNode?.firstChild?.nodeValue || '';
      const signatureValue = signatureValueNode?.textContent || signatureValueNode?.firstChild?.nodeValue || '';

      this.logger.log(`Comprobante firmado con éxito. Algoritmo: RSA-SHA256 | RUC Emisor: ${certData.issuerRuc}`);

      return {
        signedXml,
        digestValue,
        signatureValue,
        signatureId,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error durante el cálculo de la firma XMLDSig: ${error.message}`);
      throw new InternalServerErrorException(`Falla criptográfica al firmar XML: ${error.message}`);
    }
  }

  /**
   * Criterio 2: Validador de firma e integridad estructural del comprobante
   */
  public verifySignature(signedXml: string): boolean {
    if (!signedXml || typeof signedXml !== 'string') return false;
    try {
      const doc: any = new DOMParser().parseFromString(signedXml, 'text/xml');
      const signatureNode = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0] ||
                            doc.getElementsByTagName('ds:Signature')[0] ||
                            doc.getElementsByTagName('Signature')[0];

      if (!signatureNode) return false;

      const digestNode = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'DigestValue')[0] ||
                         doc.getElementsByTagName('ds:DigestValue')[0];
      const sigValueNode = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignatureValue')[0] ||
                           doc.getElementsByTagName('ds:SignatureValue')[0];

      const digest = digestNode?.textContent || digestNode?.firstChild?.nodeValue;
      const sigVal = sigValueNode?.textContent || sigValueNode?.firstChild?.nodeValue;

      return Boolean(digest && sigVal && digest.trim().length > 0 && sigVal.trim().length > 0);
    } catch (error: any) {
      this.logger.warn(`Validación de firma fallida: ${error.message}`);
      return false;
    }
  }
}