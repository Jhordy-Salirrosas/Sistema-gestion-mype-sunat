export type UserRole =
  | 'ADMIN'
  | 'CONTADOR'
  | 'OPERADOR_FACTURACION'
  | 'OPERADOR_ADUANAS'
  | 'AUDITOR';

export interface UserProps {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export class UserEntity {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get email(): string {
    return this.props.email;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  hasRole(role: UserRole): boolean {
    return this.props.role === role;
  }
}
