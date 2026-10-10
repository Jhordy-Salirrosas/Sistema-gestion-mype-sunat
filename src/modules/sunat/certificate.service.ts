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
    // La validación se realizará cuando se necesite el certificado,
    // mediante getCertificate(), y no durante el arranque de la API.
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
    // 1. Comprobar la presencia de las variables de entorno.
    if (!certBase64) {
      throw new BadRequestException(
        'Falta la variable de entorno CERT_BASE64',
      );
    }

    if (!certPassword) {
      throw new BadRequestException(
        'Falta la variable de entorno CERT_PASSWORD',
      );
    }

    if (!rucEmisor) {
      throw new BadRequestException(
        'Falta la variable de entorno RUC_EMISOR',
      );
    }

    try {
      // 2. Decodificar Base64 y procesar el archivo PKCS#12.
      const p12Der = forge.util.decode64(certBase64);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(
        p12Asn1,
        false,
        certPassword,
      );

      // 3. Extraer el certificado y la clave privada.
      let certificate: forge.pki.Certificate | null = null;
      let privateKeyPem = '';

      for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
          if (safeBag.cert) {
            certificate = safeBag.cert;
          }

          if (safeBag.key) {
            privateKeyPem = forge.pki.privateKeyToPem(
              safeBag.key,
            );
          }
        }
      }

      if (!certificate || !privateKeyPem) {
        throw new BadRequestException(
          'El archivo PKCS#12 no contiene un par de certificado y clave privada válidos',
        );
      }

      // 4. Validar la vigencia del certificado.
      const now = new Date();
      const validFrom = certificate.validity.notBefore;
      const validTo = certificate.validity.notAfter;

      if (now < validFrom || now > validTo) {
        this.logger.error(
          `Certificado digital no vigente. Vigencia: ${validFrom.toISOString()} a ${validTo.toISOString()}`,
        );

        throw new BadRequestException(
          `Certificado digital vencido o no vigente (Expiró: ${validTo.toISOString()}). Envío bloqueado.`,
        );
      }

      const diffMs = validTo.getTime() - now.getTime();
      const daysRemaining = Math.ceil(
        diffMs / (1000 * 60 * 60 * 24),
      );

      if (daysRemaining <= 30) {
        this.logger.warn(
          `El certificado vencerá en ${daysRemaining} días (${validTo.toISOString()})`,
        );
      } else {
        this.logger.log(
          `Certificado digital validado correctamente. Días restantes: ${daysRemaining}`,
        );
      }

      // 5. Comprobar que el certificado corresponda al RUC emisor.
      const subjectString = certificate.subject.attributes
        .map(
          (attr) =>
            `${attr.name || attr.shortName}=${attr.value}`,
        )
        .join(' ');

      if (!subjectString.includes(rucEmisor)) {
        this.logger.error(
          `El certificado no corresponde al RUC configurado: ${rucEmisor}`,
        );

        throw new BadRequestException(
          `El certificado digital no corresponde al RUC emisor configurado (${rucEmisor})`,
        );
      }

      // 6. Guardar el certificado validado en memoria.
      this.validatedCert = {
        certificatePem: forge.pki.certificateToPem(certificate),
        privateKeyPem,
        validFrom,
        validTo,
        issuerRuc: rucEmisor,
        daysRemaining,
      };

      return this.validatedCert;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido al procesar el certificado';

      this.logger.error(
        `Error al procesar el certificado digital: ${message}`,
      );

      throw new BadRequestException(
        `Contraseña inválida o formato PKCS#12 corrupto: ${message}`,
      );
    }
  }
}