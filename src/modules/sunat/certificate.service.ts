import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';

export interface ValidatedCertificate {
  certificatePem: string;
  privateKeyPem: string;
  validFrom: Date;
  validTo: Date;
  issuerRuc: string;
  daysRemaining: number;
}

@Injectable()
export class CertificateService implements OnModuleInit {
  private readonly logger = new Logger(CertificateService.name);
  private validatedCert: ValidatedCertificate | null = null;

  onModuleInit() {
    // Si las variables de entorno están cargadas al iniciar, valida de inmediato
    if (process.env.CERT_BASE64 && process.env.CERT_PASSWORD && process.env.RUC_EMISOR) {
      this.validarYCargarCertificado();
    }
  }

  public getCertificate(): ValidatedCertificate {
    if (!this.validatedCert) {
      return this.validarYCargarCertificado();
    }
    return this.validatedCert;
  }

  public validarYCargarCertificado(
    certBase64 = process.env.CERT_BASE64,
    certPassword = process.env.CERT_PASSWORD,
    rucEmisor = process.env.RUC_EMISOR,
  ): ValidatedCertificate {
    // 1. Criterio de Aceptación 1: Comprobar presencia de variables
    if (!certBase64) {
      throw new BadRequestException('Falta la variable de entorno CERT_BASE64');
    }
    if (!certPassword) {
      throw new BadRequestException('Falta la variable de entorno CERT_PASSWORD');
    }
    if (!rucEmisor) {
      throw new BadRequestException('Falta la variable de entorno RUC_EMISOR');
    }

    try {
      // 2. Decodificar Base64 a binario y parsear PKCS#12 en memoria
      const p12Der = forge.util.decode64(certBase64);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPassword);

      // 3. Extraer certificado y llave privada de los safeBags
      let certificate: forge.pki.Certificate | null = null;
      let privateKeyPem = '';

      for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
          if (safeBag.cert) {
            certificate = safeBag.cert;
          }
          if (safeBag.key) {
            privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
          }
        }
      }

      if (!certificate || !privateKeyPem) {
        throw new BadRequestException('El archivo PKCS#12 no contiene un par de certificado y clave privada válidos');
      }

      // 4. Criterio de Aceptación 2: Validación de vigencia del certificado
      const now = new Date();
      const validFrom = certificate.validity.notBefore;
      const validTo = certificate.validity.notAfter;

      if (now < validFrom || now > validTo) {
        this.logger.error(`Certificado digital VENCIDO. Vigencia: ${validFrom.toISOString()} a ${validTo.toISOString()}`);
        throw new BadRequestException(
          `Certificado digital vencido o no vigente (Expiró: ${validTo.toISOString()}). Envío bloqueado.`,
        );
      }

      const diffMs = validTo.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 30) {
        this.logger.warn(`ADVERTENCIA: El certificado digital vencerá en ${daysRemaining} días (${validTo.toISOString()})`);
      } else {
        this.logger.log(`Certificado digital validado con éxito. Días restantes: ${daysRemaining}`);
      }

      // 5. Criterio de Aceptación 3: Validación de correspondencia con el RUC emisor
      const subjectString = certificate.subject.attributes
        .map((attr) => `${attr.name || attr.shortName}=${attr.value}`)
        .join(' ');

      if (!subjectString.includes(rucEmisor)) {
        this.logger.error(`Discrepancia de RUC: El certificado no corresponde al RUC configurado: ${rucEmisor}`);
        throw new BadRequestException(
          `El certificado digital no corresponde al RUC emisor configurado (${rucEmisor})`,
        );
      }

      this.validatedCert = {
        certificatePem: forge.pki.certificateToPem(certificate),
        privateKeyPem,
        validFrom,
        validTo,
        issuerRuc: rucEmisor,
        daysRemaining,
      };

      return this.validatedCert;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error al procesar el certificado digital: ${error.message}`);
      throw new BadRequestException(`Contraseña inválida o formato PKCS#12 corrupto: ${error.message}`);
    }
  }
}