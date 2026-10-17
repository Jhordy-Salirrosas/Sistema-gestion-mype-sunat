import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { CertificateService } from '../../../src/modules/sunat/certificate.service';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { buildZipFileName } from '../../../src/modules/sunat/soap/soap.constants';

export interface BetaInvoicePayload {
  ruc: string;
  serie: string;
  correlativo: number;
  xml: string;
  fileName: string;
  zip: Buffer;
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable requerida ${name}`);
  return value;
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  };
  return value.replace(/[<>&'"]/g, (char) => entities[char]);
}

function createInvoiceXml(
  ruc: string,
  legalName: string,
  serie: string,
  number: number,
): string {
  const path = join(
    process.cwd(),
    'fixtures',
    'sunat-invoice',
    'factura-ubl21.xml',
  );
  if (!existsSync(path)) throw new Error(`No existe el fixture ${path}`);
  const padded = String(number).padStart(8, '0');
  return readFileSync(path, 'utf8')
    .replace(
      '<cbc:ID>F001-00000001</cbc:ID>',
      `<cbc:ID>${serie}-${padded}</cbc:ID>`,
    )
    .replace(
      /<cbc:IssueDate>[^<]+<\/cbc:IssueDate>/,
      `<cbc:IssueDate>${new Date().toISOString().slice(0, 10)}</cbc:IssueDate>`,
    )
    .replace(
      '<cbc:ID schemeID="6">20123456786</cbc:ID>',
      `<cbc:ID schemeID="6">${ruc}</cbc:ID>`,
    )
    .replace(
      '<cbc:RegistrationName>EMPRESA DE PRUEBA S.A.C.</cbc:RegistrationName>',
      `<cbc:RegistrationName>${escapeXml(legalName)}</cbc:RegistrationName>`,
    )
    .replace(
      '<cbc:Name>EMPRESA DE PRUEBA S.A.C.</cbc:Name>',
      `<cbc:Name>${escapeXml(legalName)}</cbc:Name>`,
    );
}

export function createBetaInvoicePayload(): BetaInvoicePayload {
  const ruc = requiredEnv('SUNAT_BETA_RUC');
  const serie = requiredEnv('SUNAT_BETA_SERIE').toUpperCase();
  const correlativo = Number(requiredEnv('SUNAT_BETA_CORRELATIVO'));
  const password = requiredEnv('SUNAT_SOL_PASSWORD');
  const solUser = requiredEnv('SUNAT_SOL_USER');
  if (
    !/^\d{11}$/.test(ruc) ||
    !/^[A-Z0-9]{1,4}$/.test(serie) ||
    !Number.isSafeInteger(correlativo) ||
    correlativo < 1
  ) {
    throw new Error('RUC, serie o correlativo de Beta inválidos');
  }
  if (
    password === 'moddatos' &&
    (ruc !== '20000000001' || solUser !== 'MODDATOS')
  ) {
    throw new Error(
      'Las credenciales estándar moddatos requieren RUC 20000000001 y usuario MODDATOS',
    );
  }

  const certificate = new CertificateService();
  certificate.validarYCargarCertificado(
    requiredEnv('SUNAT_BETA_CERT_BASE64'),
    requiredEnv('SUNAT_BETA_CERT_PASSWORD'),
    ruc,
  );
  const xml = new SignatureService(certificate).signXml(
    createInvoiceXml(
      ruc,
      requiredEnv('SUNAT_BETA_LEGAL_NAME'),
      serie,
      correlativo,
    ),
  ).signedXml;
  const fileName = buildZipFileName({
    ruc,
    tipoComprobante: '01',
    serie,
    correlativo,
  });
  const archive = new AdmZip();
  archive.addFile(
    fileName.replace(/\.zip$/i, '.xml'),
    Buffer.from(xml, 'utf8'),
  );
  return { ruc, serie, correlativo, xml, fileName, zip: archive.toBuffer() };
}
