import { SettlementType } from '../enums/settlementType.enum';

export interface CreateSettlementData {
  declarationId: string;
  settlementType: SettlementType;
  settlementNumber: string;
  taxCode: string;
  amountUsd?: number;
  amountPen: number;
  cdaNumber?: string | null;
  dueDate: Date;
}

export interface PaySettlementData {
  settlementId: string;
  bankCode: string;
  bankOperationNumber: string;
  paidAt: Date;
  voucherStorageUrl?: string | null;
}

export const CUSTOMS_SETTLEMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SETTLEMENT_REPOSITORY_PORT');

export interface ICustomsSettlementRepositoryPort {
  createSettlements(settlements: CreateSettlementData[]): Promise<any[]>;
  findSettlementById(id: string): Promise<any | null>;
  findSettlementsByDeclarationId(declarationId: string): Promise<any[]>;
  findPendingSettlementsByCompany(companyId: string): Promise<any[]>;
  registerSettlementPayment(data: PaySettlementData): Promise<any>;
}
