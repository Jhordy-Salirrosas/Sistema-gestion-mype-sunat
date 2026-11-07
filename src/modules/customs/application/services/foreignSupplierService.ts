import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { CreateForeignSupplierDto, UpdateForeignSupplierDto } from '../dto/foreignSupplierDto';

/** Maestro de proveedores del exterior, aislado por empresa. */
@Injectable()
export class ForeignSupplierService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string, q?: string) {
    return this.prisma.foreignSupplier.findMany({
      where: {
        company_id: companyId,
        ...(q ? { OR: [{ business_name: { contains: q, mode: 'insensitive' } }, { tax_id: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { business_name: 'asc' },
      take: 200,
    });
  }

  async create(companyId: string, dto: CreateForeignSupplierDto) {
    try {
      return await this.prisma.foreignSupplier.create({
        data: {
          company_id: companyId,
          tax_id: dto.taxId?.trim() || null,
          business_name: dto.businessName.trim(),
          country_code: dto.countryCode.toUpperCase(),
          default_currency: (dto.defaultCurrency ?? 'USD').toUpperCase(),
          is_related: dto.isRelated ?? false,
          address: dto.address?.trim() || null,
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          contact_name: dto.contactName?.trim() || null,
          payment_terms: dto.paymentTerms?.trim() || null,
          bank_name: dto.bankName?.trim() || null,
          bank_account: dto.bankAccount?.trim() || null,
          swift_code: dto.swiftCode?.trim() || null,
          vessel_name: dto.vesselName?.trim() || null,
          voyage_number: dto.voyageNumber?.trim() || null,
          bl_number: dto.blNumber?.trim() || null,
          port_origin: dto.portOrigin?.trim() || null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Ya existe un proveedor con ese tax ID en la empresa.');
      }
      throw error;
    }
  }

  async update(companyId: string, id: string, dto: UpdateForeignSupplierDto) {
    await this.get(companyId, id);
    return this.prisma.foreignSupplier.update({
      where: { id },
      data: {
        ...(dto.taxId !== undefined ? { tax_id: dto.taxId?.trim() || null } : {}),
        ...(dto.businessName !== undefined ? { business_name: dto.businessName.trim() } : {}),
        ...(dto.countryCode !== undefined ? { country_code: dto.countryCode.toUpperCase() } : {}),
        ...(dto.defaultCurrency !== undefined ? { default_currency: dto.defaultCurrency.toUpperCase() } : {}),
        ...(dto.isRelated !== undefined ? { is_related: dto.isRelated } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.contactName !== undefined ? { contact_name: dto.contactName?.trim() || null } : {}),
        ...(dto.paymentTerms !== undefined ? { payment_terms: dto.paymentTerms?.trim() || null } : {}),
        ...(dto.bankName !== undefined ? { bank_name: dto.bankName?.trim() || null } : {}),
        ...(dto.bankAccount !== undefined ? { bank_account: dto.bankAccount?.trim() || null } : {}),
        ...(dto.swiftCode !== undefined ? { swift_code: dto.swiftCode?.trim() || null } : {}),
        ...(dto.vesselName !== undefined ? { vessel_name: dto.vesselName?.trim() || null } : {}),
        ...(dto.voyageNumber !== undefined ? { voyage_number: dto.voyageNumber?.trim() || null } : {}),
        ...(dto.blNumber !== undefined ? { bl_number: dto.blNumber?.trim() || null } : {}),
        ...(dto.portOrigin !== undefined ? { port_origin: dto.portOrigin?.trim() || null } : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.foreignSupplier.delete({ where: { id } });
    return { deleted: true };
  }

  private async get(companyId: string, id: string) {
    const supplier = await this.prisma.foreignSupplier.findFirst({ where: { id, company_id: companyId } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado en la empresa.');
    return supplier;
  }
}
