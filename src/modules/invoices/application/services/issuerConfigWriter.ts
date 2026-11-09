import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../database/prismaService';
import { CertificateService } from '../../../sunat/certificate.service';
import { IssuerConfigEncryption } from '../../../sunat/issuerConfigEncryption';
import { IssuerConfigResolver } from '../../../sunat/issuerConfigResolver';

export type PerfilComercial = 'MAYORISTA' | 'MINORISTA';

export interface IssuerConfigInput {
  action?: 'save' | 'reset';
  local_anexo?: string | null;
  domicilio_fiscal?: string | null;
  ubigeo_fiscal?: string | null;
  departamento_fiscal?: string | null;
  provincia_fiscal?: string | null;
  distrito_fiscal?: string | null;

  entorno?: 'MOCK' | 'BETA' | 'PRODUCCION';
  perfil_comercial?: PerfilComercial | null;
  sol_user?: string;
  sol_password?: string;
  cert_base64?: string;
  cert_password?: string;
}

/** Closed input, validated independently of global ValidationPipe settings. */
export function validateIssuerInput(body: unknown): IssuerConfigInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('CONFIG_INPUT_INVALID');
  const limits: Record<string, number> = {
    action: 5,
    local_anexo: 4,
    domicilio_fiscal: 500,
    ubigeo_fiscal: 6,
    departamento_fiscal: 100,
    provincia_fiscal: 100,
    distrito_fiscal: 100,

    entorno: 10,
    perfil_comercial: 12,
    sol_user: 64,
    sol_password: 256,
    cert_base64: 131072,
    cert_password: 256,
  };
  for (const [key, value] of Object.entries(body)) {
    if (['perfil_comercial', 'local_anexo', 'domicilio_fiscal', 'ubigeo_fiscal', 'departamento_fiscal', 'provincia_fiscal', 'distrito_fiscal'].includes(key) && value === null) continue;
    if (
      !Object.hasOwn(limits, key) ||
      typeof value !== 'string' ||
      value.length > limits[key]
    )
      throw new BadRequestException('CONFIG_INPUT_INVALID');
  }
  const input = body as IssuerConfigInput;
  if (input.action && !['save', 'reset'].includes(input.action))
    throw new BadRequestException('CONFIG_ACTION_INVALID');
  if (input.entorno && !['MOCK', 'BETA', 'PRODUCCION'].includes(input.entorno))
    throw new BadRequestException('CONFIG_ENV_INVALID');
  if (
    input.perfil_comercial !== undefined &&
    input.perfil_comercial !== null &&
    !['MAYORISTA', 'MINORISTA'].includes(input.perfil_comercial)
  )
    throw new BadRequestException('CONFIG_PROFILE_INVALID');
  for (const [campo, patron] of [['local_anexo', /^\d{4}$/], ['ubigeo_fiscal', /^\d{6}$/]] as const) {
    if (input[campo] != null && input[campo]!.trim() && !patron.test(input[campo]!.trim())) throw new BadRequestException('CONFIG_FISCAL_INVALID');
  }
  if (input.action === 'reset' && Object.keys(input).length !== 1)
    throw new BadRequestException('CONFIG_RESET_INVALID');
  return input;
}
const supplied = (value?: string) =>
  Boolean(value?.trim() && !/^[*•●]+$/.test(value.trim()));

@Injectable()
export class IssuerConfigWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IssuerConfigEncryption,
    private readonly resolver: IssuerConfigResolver,
    private readonly certificates: CertificateService,
  ) {}

  async save(companyId: string, body: unknown): Promise<void> {
    const input = validateIssuerInput(body);
    if (!companyId) throw new BadRequestException('ISSUER_COMPANY_REQUIRED');
    try {
      await this.prisma.$transaction(async (tx) => {
        // Serialize partial updates, so omitted secrets retain the latest committed value.
        await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
        const company = await tx.company.findUnique({
          where: { id: companyId },
        });
        if (!company) throw new NotFoundException('ISSUER_COMPANY_NOT_FOUND');
        for (const [campo, patron] of [['local_anexo', /^\d{4}$/], ['ubigeo_fiscal', /^\d{6}$/]] as const) {
    if (input[campo] != null && input[campo]!.trim() && !patron.test(input[campo]!.trim())) throw new BadRequestException('CONFIG_FISCAL_INVALID');
  }
  if (input.action === 'reset') {
          await tx.company.update({
            where: { id: companyId },
            data: {
              issuer_config_activated_at: null,
              issuer_config_version: randomUUID(),
            },
          });
          return;
        }
        const active = Boolean(company.issuer_config_activated_at);
        // Preserve omitted fields, but only explicitly configured groups are eligible for resolution.
        const data = {
          local_anexo: input.local_anexo === undefined ? company.local_anexo : input.local_anexo?.trim() || null,
          domicilio_fiscal: input.domicilio_fiscal === undefined ? company.domicilio_fiscal : input.domicilio_fiscal?.trim() || null,
          ubigeo_fiscal: input.ubigeo_fiscal === undefined ? company.ubigeo_fiscal : input.ubigeo_fiscal?.trim() || null,
          departamento_fiscal: input.departamento_fiscal === undefined ? company.departamento_fiscal : input.departamento_fiscal?.trim() || null,
          provincia_fiscal: input.provincia_fiscal === undefined ? company.provincia_fiscal : input.provincia_fiscal?.trim() || null,
          distrito_fiscal: input.distrito_fiscal === undefined ? company.distrito_fiscal : input.distrito_fiscal?.trim() || null,
          sol_user: company.sol_user,
          sol_pass_encrypted: company.sol_pass_encrypted,
          cert_storage_url: company.cert_storage_url,
          cert_pass_encrypted: company.cert_pass_encrypted,
          issuer_sol_configured: company.issuer_sol_configured,
          issuer_cert_configured: company.issuer_cert_configured,
          commercial_profile:
            input.perfil_comercial !== undefined
              ? input.perfil_comercial
              : (company as { commercial_profile?: string | null }).commercial_profile ?? null,
          issuer_environment:
            input.entorno ?? (active ? company.issuer_environment : null),
          issuer_config_activated_at: new Date(),
          issuer_config_version: randomUUID(),
        };
        const changesSol =
          supplied(input.sol_user) || supplied(input.sol_password);
        const changesCert =
          supplied(input.cert_base64) || supplied(input.cert_password);
        if (changesSol) {
          if (
            !company.issuer_sol_configured &&
            !(supplied(input.sol_user) && supplied(input.sol_password))
          )
            throw new BadRequestException('ISSUER_SOL_GROUP_INCOMPLETE');
          data.issuer_sol_configured = true;
        }
        if (changesCert) {
          if (
            !company.issuer_cert_configured &&
            !(supplied(input.cert_base64) && supplied(input.cert_password))
          )
            throw new BadRequestException('ISSUER_CERT_GROUP_INCOMPLETE');
          data.issuer_cert_configured = true;
        }
        if (supplied(input.sol_user)) data.sol_user = input.sol_user!.trim();
        if (supplied(input.sol_password))
          data.sol_pass_encrypted = this.encryption.encrypt(
            input.sol_password!,
            companyId,
            'sol_pass_encrypted',
          );
        if (supplied(input.cert_password))
          data.cert_pass_encrypted = this.encryption.encrypt(
            input.cert_password!,
            companyId,
            'cert_pass_encrypted',
          );
        if (supplied(input.cert_base64)) {
          if (
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              input.cert_base64!,
            )
          )
            throw new BadRequestException('CONFIG_CERT_INVALID');
          const id = randomUUID();
          await tx.issuerCertificate.create({
            data: {
              id,
              company_id: companyId,
              encrypted_content: this.encryption.encrypt(
                input.cert_base64!,
                companyId,
                'certificate_pkcs12',
              ),
            },
          });
          data.cert_storage_url = `private:${id}`;
        }
        const context = await this.resolver.fromCompany(
          { ...company, ...data },
          tx,
        );
        if (
          context.certificate &&
          (supplied(input.cert_base64) || supplied(input.cert_password))
        ) {
          try {
            this.certificates.validarYCargarCertificado(
              context.certificate.base64,
              context.certificate.password,
              company.ruc,
            );
          } catch {
            throw new BadRequestException('CONFIG_CERT_INVALID');
          }
        }
        await tx.company.update({ where: { id: companyId }, data });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('CONFIG_SAVE_FAILED');
    }
  }
}
