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
  createdAt?: Date;
  updatedAt?: Date;
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

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  hasRole(role: UserRole): boolean {
    return this.props.role === role;
  }

  isActiveAccount(): boolean {
    return this.props.isActive;
  }

  updateFullName(newFullName: string): UserEntity {
    return new UserEntity({
      ...this.props,
      fullName: newFullName.trim(),
      updatedAt: new Date(),
    });
  }
}
