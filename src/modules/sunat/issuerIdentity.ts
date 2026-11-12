import { BadRequestException } from '@nestjs/common';

export interface IssuerIdentity {
  ruc: string;
  origen: 'issuer_config' | 'company';
}

/** La identidad fiscal de M1 no modifica la identidad compartida de la empresa. */
export function resolveIssuerIdentity(company: { ruc: string; issuer_ruc?: string | null }): IssuerIdentity {
  if (company.issuer_ruc == null) return { ruc: company.ruc, origen: 'company' };
  if (!/^[0-9]{11}$/.test(company.issuer_ruc)) throw new BadRequestException('ISSUER_RUC_INVALID');
  return { ruc: company.issuer_ruc, origen: 'issuer_config' };
}

export function issuerSolUsername(identity: IssuerIdentity, user: string): string {
  // Sin pin se conserva la composición histórica, incluso para usuarios legados.
  if (identity.origen === 'issuer_config' && /^[0-9]{11}/.test(user) && !user.startsWith(identity.ruc)) {
    throw new BadRequestException('ISSUER_SOL_RUC_MISMATCH');
  }
  return user.startsWith(identity.ruc) ? user : identity.ruc + user;
}
