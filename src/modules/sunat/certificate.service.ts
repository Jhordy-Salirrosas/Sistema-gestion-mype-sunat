import { createHash } from 'node:crypto';
import type { IssuerContext } from './issuerConfigResolver';
import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
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
  private readonly cache = new Map<string, ValidatedCertificate>();

  onModuleInit() {
    // La validación se realizará cuando se necesite el certificado,
    // mediante getCertificate(), y no durante el arranque de la API.
  }

  public getCertificate(context?: IssuerContext): ValidatedCertificate {
    const base64 = context
      ? context.certificate?.base64
      : process.env.CERT_BASE64;
    const password = context
      ? context.certificate?.password
      : process.env.CERT_PASSWORD;
    const ruc = context?.ruc ?? process.env.RUC_EMISOR;
    const key = JSON.stringify([
      context?.companyId ?? 'deployment',
      context?.version,
      ruc,
      createHash('sha256')
        .update(JSON.stringify([base64, password]))
        .digest('hex'),
    ]);
    const cached = this.cache.get(key);
    if (
      cached &&
      cached.validFrom <= new Date() &&
      cached.validTo >= new Date()
    )
      return {
        ...cached,
        daysRemaining: Math.ceil(
          (cached.validTo.getTime() - Date.now()) / 86400000,
        ),
      };
    const certificate = this.validarYCargarCertificado(
      base64 ?? '',
      password ?? '',
      ruc ?? '',
    );
    if (this.cache.size >= 100) this.cache.clear();
    this.cache.set(key, certificate);
    return certificate;
  }

  public validarYCargarCertificado(
    certBase64 = process.env.CERT_BASE64,
    certPassword = process.env.CERT_PASSWORD,
    rucEmisor = process.env.RUC_EMISOR,
  ): ValidatedCertificate {
    // 1. Comprobar la presencia de las variables de entorno.
    if (!certBase64) {
      throw new BadRequestException('Falta la variable de entorno CERT_BASE64');
    }

    if (!certPassword) {
      throw new BadRequestException(
        'Falta la variable de entorno CERT_PASSWORD',
      );
    }

    if (!rucEmisor) {
      throw new BadRequestException('Falta la variable de entorno RUC_EMISOR');
    }

    try {
      // 2. Decodificar Base64 y procesar el archivo PKCS#12.
      const p12Der = forge.util.decode64(certBase64);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPassword);

      // 3. Extraer el certificado y la clave privada.
      const certificates: forge.pki.Certificate[] = [];
      let privateKeyPem = '';

      for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
          if (safeBag.cert) {
            certificates.push(safeBag.cert);
          }

          if (safeBag.key) {
            privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
          }
        }
      }

      if (!privateKeyPem) {
        throw new BadRequestException(
          'El archivo PKCS#12 no contiene una clave privada válida',
        );
      }
      const key = forge.pki.privateKeyFromPem(
        privateKeyPem,
      ) as forge.pki.rsa.PrivateKey;
      // A PKCS#12 may contain intermediate certificates after the issuer leaf.
      const certificate = certificates.find((candidate) => {
        const publicKey = candidate.publicKey as forge.pki.rsa.PublicKey;
        return (
          publicKey.n && key.n.equals(publicKey.n) && key.e.equals(publicKey.e)
        );
      });
      if (!certificate) {
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
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
      if (
        !certificate.subject.attributes.some((attr) =>
          String(attr.value)
            .split(/[^0-9]+/)
            .includes(rucEmisor),
        )
      ) {
        this.logger.error(
          `El certificado no corresponde al RUC configurado: ${rucEmisor}`,
        );

        throw new BadRequestException(
          `El certificado digital no corresponde al RUC emisor configurado (${rucEmisor})`,
        );
      }

      // 6. Guardar el certificado validado en memoria.
      const validatedCert: ValidatedCertificate = {
        certificatePem: forge.pki.certificateToPem(certificate),
        privateKeyPem,
        validFrom,
        validTo,
        issuerRuc: rucEmisor,
        daysRemaining,
      };

      return validatedCert;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('No se pudo procesar el certificado digital');
      throw new BadRequestException(
        'Contraseña inválida o formato PKCS#12 corrupto',
      );
    }
  }
}
