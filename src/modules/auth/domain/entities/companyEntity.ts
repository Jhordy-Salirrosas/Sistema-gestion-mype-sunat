export interface CompanyProps {
  id: string;
  ruc: string;
  legalName: string;
  tradeName?: string | null;
  solUser: string;
  solPassEncrypted: string;
  certStorageUrl?: string | null;
  certPassEncrypted?: string | null;
  sireClientIdEnc?: string | null;
  sireClientSecretEnc?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CompanyEntity {
  constructor(private readonly props: CompanyProps) {}

  get id(): string {
    return this.props.id;
  }

  get ruc(): string {
    return this.props.ruc;
  }

  get legalName(): string {
    return this.props.legalName;
  }

  get tradeName(): string | null {
    return this.props.tradeName ?? null;
  }

  get solUser(): string {
    return this.props.solUser;
  }

  get solPassEncrypted(): string {
    return this.props.solPassEncrypted;
  }

  get certStorageUrl(): string | null {
    return this.props.certStorageUrl ?? null;
  }

  get certPassEncrypted(): string | null {
    return this.props.certPassEncrypted ?? null;
  }

  get sireClientIdEnc(): string | null {
    return this.props.sireClientIdEnc ?? null;
  }

  get sireClientSecretEnc(): string | null {
    return this.props.sireClientSecretEnc ?? null;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  isActiveCompany(): boolean {
    return this.props.isActive;
  }
}
