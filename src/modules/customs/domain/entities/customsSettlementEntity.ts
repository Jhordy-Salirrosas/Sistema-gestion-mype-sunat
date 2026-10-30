export type SettlementTypeDomain =
  | 'TIPO_0010_DECLARACION'
  | 'TIPO_0026_MAYOR_VALOR'
  | 'TIPO_0027_MULTA'
  | 'RESOLUCION_MULTA_RM65';

export type SettlementStatusDomain =
  | 'GENERADA'
  | 'PAGADA'
  | 'GARANTIZADA'
  | 'VENCIDA'
  | 'ANULADA';

export interface CustomsSettlementProps {
  id?: string;
  declarationId: string;
  settlementType: SettlementTypeDomain;
  settlementNumber: string;
  taxCode: string;
  amountUsd?: number;
  amountPen: number;
  cdaNumber?: string | null;
  dueDate: Date;
  status: SettlementStatusDomain;
  paidAt?: Date | null;
  bankCode?: string | null;
  bankOperationNumber?: string | null;
  voucherStorageUrl?: string | null;
  createdAt?: Date;
}

export class CustomsSettlementEntity {
  constructor(private readonly props: CustomsSettlementProps) {}

  get id(): string | undefined {
    return this.props.id;
  }

  get declarationId(): string {
    return this.props.declarationId;
  }

  get settlementType(): SettlementTypeDomain {
    return this.props.settlementType;
  }

  get settlementNumber(): string {
    return this.props.settlementNumber;
  }

  get taxCode(): string {
    return this.props.taxCode;
  }

  get amountUsd(): number {
    return this.props.amountUsd ?? 0.0;
  }

  get amountPen(): number {
    return this.props.amountPen;
  }

  get cdaNumber(): string | null | undefined {
    return this.props.cdaNumber;
  }

  get dueDate(): Date {
    return this.props.dueDate;
  }

  get status(): SettlementStatusDomain {
    return this.props.status;
  }

  get paidAt(): Date | null | undefined {
    return this.props.paidAt;
  }

  get bankCode(): string | null | undefined {
    return this.props.bankCode;
  }

  get bankOperationNumber(): string | null | undefined {
    return this.props.bankOperationNumber;
  }

  get voucherStorageUrl(): string | null | undefined {
    return this.props.voucherStorageUrl;
  }

  isPaid(): boolean {
    return this.props.status === 'PAGADA';
  }

  isGuaranteed(): boolean {
    return this.props.status === 'GARANTIZADA';
  }

  isOverdue(currentDate: Date = new Date()): boolean {
    return !this.isPaid() && !this.isGuaranteed() && this.props.dueDate < currentDate;
  }

  pay(data: {
    bankCode: string;
    bankOperationNumber: string;
    paidAt?: Date;
    voucherStorageUrl?: string;
  }): void {
    if (this.props.status === 'PAGADA') {
      throw new Error('La liquidación aduanera ya se encuentra cancelada.');
    }
    this.props.status = 'PAGADA';
    this.props.bankCode = data.bankCode;
    this.props.bankOperationNumber = data.bankOperationNumber;
    this.props.paidAt = data.paidAt ?? new Date();
    this.props.voucherStorageUrl = data.voucherStorageUrl ?? this.props.voucherStorageUrl;
  }

  applyGuarantee(): void {
    if (this.props.status === 'PAGADA') {
      throw new Error('No se puede garantizar una liquidación que ya fue pagada.');
    }
    this.props.status = 'GARANTIZADA';
  }

  toPrimitives(): CustomsSettlementProps {
    return { ...this.props };
  }
}

