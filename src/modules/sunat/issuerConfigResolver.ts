import { resolveIssuerIdentity, issuerSolUsername, type IssuerIdentity } from './issuerIdentity';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prismaService';
import { IssuerConfigEncryption } from './issuerConfigEncryption';
import { resolveEndpoint, resolveTimeout, normalizarEntorno, endpointCoherente } from './soap/sunatBillTypes';
import { SUNAT_BILL_SERVICE_URLS } from './soap/soap.constants';

export interface IssuerContext {
  readonly companyId: string;
  readonly local_anexo?: string | null;
  readonly domicilio_fiscal?: string | null;
  readonly ubigeo_fiscal?: string | null;
  readonly departamento_fiscal?: string | null;
  readonly provincia_fiscal?: string | null;
  readonly distrito_fiscal?: string | null;

  readonly ruc: string;
  readonly rucSource?: IssuerIdentity['origen'];
  readonly version: string;
  readonly source: 'company' | 'deployment';
  readonly solSource?: 'company' | 'deployment';
  readonly certificateSource?: 'company' | 'deployment';
  readonly environment: 'MOCK' | 'BETA' | 'PRODUCCION' | null;
  readonly endpoint: string;
  readonly consultEndpoint: string;
  readonly timeoutMs: number;
  readonly commercialProfile?: 'MAYORISTA' | 'MINORISTA' | null;
  readonly sol: Readonly<{ username: string; password: string }> | null;
  readonly certificate: Readonly<{ base64: string; password: string }> | null;
}

export function deploymentContext(
  companyId: string,
  ruc: string,
  rucSource: IssuerIdentity['origen'] = 'company',
): IssuerContext {
  const environment = normalizarEntorno(process.env.SUNAT_ENV);
  const user = process.env.SUNAT_SOL_USER;
  const password = process.env.SUNAT_SOL_PASSWORD;
  const base64 = process.env.CERT_BASE64;
  const certPassword = process.env.CERT_PASSWORD;
  const endpoint = resolveEndpoint();
  return Object.freeze({
    companyId,
    ruc,
    rucSource,
    version: 'deployment',
    source: 'deployment',
    solSource: 'deployment',
    certificateSource: 'deployment',
    commercialProfile: null,
    environment,
    endpoint,
    consultEndpoint:
      process.env.SUNAT_CONSULT_SERVICE_URL ??
      endpoint.replace(/\/billService$/, '/billConsultService'),
    timeoutMs: resolveTimeout(),
    sol:
      user && password
        ? Object.freeze({
            username: issuerSolUsername({ ruc, origen: rucSource }, user),
            password,
          })
        : null,
    certificate:
      base64 && certPassword
        ? Object.freeze({ base64, password: certPassword })
        : null,
  });
}

@Injectable()
export class IssuerConfigResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IssuerConfigEncryption,
  ) {}

  async resolve(companyId: string): Promise<IssuerContext> {
    if (!companyId) throw new BadRequestException('ISSUER_COMPANY_REQUIRED');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('ISSUER_COMPANY_NOT_FOUND');
    return this.fromCompany(company, this.prisma);
  }

  async fromCompany(
    company: {
      id: string;
      ruc: string;
      issuer_ruc?: string | null;
      issuer_config_activated_at: Date | null;
      issuer_config_version: string | null;
      issuer_sol_configured?: boolean | null;
      issuer_cert_configured?: boolean | null;
      issuer_environment: string | null;
      commercial_profile?: string | null;
      local_anexo?: string | null;
      domicilio_fiscal?: string | null;
      ubigeo_fiscal?: string | null;
      departamento_fiscal?: string | null;
      provincia_fiscal?: string | null;
      distrito_fiscal?: string | null;

      sol_user: string;
      sol_pass_encrypted: string;
      cert_storage_url: string | null;
      cert_pass_encrypted: string | null;
    },
    db: Pick<PrismaService, 'issuerCertificate'>,
  ): Promise<IssuerContext> {
    const rawProfile = company.commercial_profile?.trim().toUpperCase();
    const commercialProfile: 'MAYORISTA' | 'MINORISTA' | null =
      rawProfile === 'MAYORISTA' || rawProfile === 'MINORISTA' ? rawProfile : null;
    const identity = resolveIssuerIdentity(company);
    const fallback = Object.freeze({ ...deploymentContext(company.id, identity.ruc),
      rucSource: identity.origen,
      local_anexo: company.local_anexo ?? null,
      domicilio_fiscal: company.domicilio_fiscal ?? null,
      ubigeo_fiscal: company.ubigeo_fiscal ?? null,
      departamento_fiscal: company.departamento_fiscal ?? null,
      provincia_fiscal: company.provincia_fiscal ?? null,
      distrito_fiscal: company.distrito_fiscal ?? null,
    });
    const deploymentSol = () => fallback.sol ? Object.freeze({
      ...fallback.sol, username: issuerSolUsername(identity, process.env.SUNAT_SOL_USER!),
    }) : null;
    if (!company.issuer_config_activated_at) {
      const sol = deploymentSol();
      const resolved = Object.freeze({ ...fallback, sol });
      return commercialProfile ? Object.freeze({ ...resolved, commercialProfile }) : resolved;
    }
    const hasSol = company.issuer_sol_configured === true;
    if (hasSol && !(company.sol_user && company.sol_pass_encrypted))
      throw new BadRequestException('ISSUER_SOL_GROUP_INCOMPLETE');
    const sol = hasSol
      ? Object.freeze({
          username: issuerSolUsername(identity, company.sol_user),
          password: this.encryption.decrypt(
            company.sol_pass_encrypted,
            company.id,
            'sol_pass_encrypted',
          ),
        })
      : deploymentSol();
    const hasCert = company.issuer_cert_configured === true;
    let certificate = fallback.certificate;
    if (hasCert) {
      if (
        !company.cert_storage_url?.startsWith('private:') ||
        !company.cert_pass_encrypted
      )
        throw new BadRequestException('ISSUER_CERT_GROUP_INCOMPLETE');
      const stored = await db.issuerCertificate.findFirst({
        where: {
          id: company.cert_storage_url.slice(8),
          company_id: company.id,
        },
      });
      if (!stored) throw new BadRequestException('ISSUER_CERT_UNAVAILABLE');
      certificate = Object.freeze({
        base64: this.encryption.decrypt(
          stored.encrypted_content,
          company.id,
          'certificate_pkcs12',
        ),
        password: this.encryption.decrypt(
          company.cert_pass_encrypted,
          company.id,
          'cert_pass_encrypted',
        ),
      });
    }
    const environment = company.issuer_environment ?? fallback.environment;
    if (environment !== null && !['MOCK', 'BETA', 'PRODUCCION'].includes(environment))
      throw new BadRequestException('ISSUER_ENV_INVALID');
    const endpoint = !company.issuer_environment
      ? fallback.endpoint
      : environment === 'PRODUCCION'
        ? SUNAT_BILL_SERVICE_URLS.produccion
        : environment === 'BETA'
          ? SUNAT_BILL_SERVICE_URLS.beta
          : endpointCoherente('MOCK', fallback.endpoint) ? fallback.endpoint : '';
    return Object.freeze({
      ...fallback,
      source: 'company',
      solSource: hasSol ? 'company' : 'deployment',
      certificateSource: hasCert ? 'company' : 'deployment',
      commercialProfile,
      version: company.issuer_config_version ?? '',
      environment: environment as IssuerContext['environment'],
      endpoint,
      consultEndpoint: environment === 'MOCK'
        ? endpointCoherente('MOCK', fallback.consultEndpoint) ? fallback.consultEndpoint : ''
        : company.issuer_environment
        ? endpoint.replace(/\/billService$/, '/billConsultService')
        : fallback.consultEndpoint,
      sol,
      certificate,
    });
  }
}
