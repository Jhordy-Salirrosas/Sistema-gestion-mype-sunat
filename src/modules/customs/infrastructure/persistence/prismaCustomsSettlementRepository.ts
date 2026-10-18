import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  CreateSettlementData,
  ICustomsSettlementRepositoryPort,
  PaySettlementData,
} from '../../domain/ports/customsSettlementRepositoryPort';
import { SettlementStatus } from '../../domain/enums/settlementStatus.enum';

@Injectable()
export class PrismaCustomsSettlementRepository implements ICustomsSettlementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createSettlements(settlements: CreateSettlementData[]): Promise<any[]> {
    const created: any[] = [];
    for (const s of settlements) {
      const row = await this.prisma.customsSettlement.create({
        data: {
          declaration_id: s.declarationId,
          settlement_type: s.settlementType as any,
          settlement_number: s.settlementNumber,
          tax_code: s.taxCode,
          amount_usd: s.amountUsd ?? 0.0,
          amount_pen: s.amountPen,
          cda_number: s.cdaNumber,
          due_date: s.dueDate,
          status: SettlementStatus.GENERADA as any,
        },
      });
      created.push(row);
    }
    return created;
  }

  async findSettlementById(id: string): Promise<any | null> {
    return this.prisma.customsSettlement.findUnique({
      where: { id },
      include: {
        declaration: {
          include: {
            shipment: true,
          },
        },
      },
    });
  }

  async findSettlementsByDeclarationId(declarationId: string): Promise<any[]> {
    return this.prisma.customsSettlement.findMany({
      where: { declaration_id: declarationId },
      orderBy: { due_date: 'asc' },
    });
  }

  async findPendingSettlementsByCompany(companyId: string): Promise<any[]> {
    return this.prisma.customsSettlement.findMany({
      where: {
        declaration: {
          company_id: companyId,
        },
        status: SettlementStatus.GENERADA as any,
      },
      include: {
        declaration: {
          select: {
            dua_number: true,
            numeration_date: true,
            channel: true,
          },
        },
      },
      orderBy: { due_date: 'asc' },
    });
  }

  async registerSettlementPayment(data: PaySettlementData): Promise<any> {
    return this.prisma.customsSettlement.update({
      where: { id: data.settlementId },
      data: {
        status: SettlementStatus.PAGADA as any,
        bank_code: data.bankCode,
        bank_operation_number: data.bankOperationNumber,
        paid_at: data.paidAt,
        voucher_storage_url: data.voucherStorageUrl,
      },
    });
  }
}
