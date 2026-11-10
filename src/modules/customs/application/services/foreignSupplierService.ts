import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { ForeignSupplierDto } from '../dto/foreignSupplierDto';

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

  async create(companyId: string, dto: ForeignSupplierDto) {
    if (!dto.businessName?.trim() || !dto.countryCode?.trim()) {
      throw new BadRequestException('Razón social y país son obligatorios.');
    }
    const businessName = dto.businessName.trim();
    const countryCode = dto.countryCode.toUpperCase();
    const defaultCurrency = (dto.defaultCurrency ?? 'USD').toUpperCase();

    try {
      const supplier = await this.prisma.foreignSupplier.create({
        data: {
          company_id: companyId,
          tax_id: dto.taxId?.trim() || null,
          business_name: businessName,
          country_code: countryCode,
          default_currency: defaultCurrency,
          is_related: dto.isRelated ?? false,
          address: dto.address?.trim() || null,
          city: dto.city?.trim() || null,
          postal_code: dto.postalCode?.trim() || null,
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

      // Sincronizar automáticamente con BusinessPartner (maestro central)
      try {
        if (this.prisma.businessPartner?.upsert) {
          const partnerDocNumber = dto.taxId?.trim() || `EXT-${supplier.id.slice(0, 8)}`;
          const roles = ['PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR'];
          const partner = await this.prisma.businessPartner.upsert({
            where: {
              company_id_doc_type_doc_number: {
                company_id: companyId,
                doc_type: '0',
                doc_number: partnerDocNumber,
              },
            },
            update: {
              legal_name: businessName,
              trade_name: businessName,
              country_code: countryCode,
              roles,
              currency_code: defaultCurrency,
              payment_terms: dto.paymentTerms?.trim() || null,
              address: dto.address?.trim() || null,
              email: dto.email?.trim() || null,
              phone: dto.phone?.trim() || null,
            },
            create: {
              company_id: companyId,
              doc_type: '0',
              doc_number: partnerDocNumber,
              legal_name: businessName,
              trade_name: businessName,
              country_code: countryCode,
              roles,
              currency_code: defaultCurrency,
              payment_terms: dto.paymentTerms?.trim() || null,
              address: dto.address?.trim() || null,
              email: dto.email?.trim() || null,
              phone: dto.phone?.trim() || null,
            },
          });

          if (dto.bankName || dto.bankAccount || dto.swiftCode) {
            const existingAccount = await this.prisma.partnerBankAccount?.findFirst?.({
              where: { partner_id: partner.id },
            });
            if (existingAccount && this.prisma.partnerBankAccount?.update) {
              await this.prisma.partnerBankAccount.update({
                where: { id: existingAccount.id },
                data: {
                  bank_name: dto.bankName?.trim() || existingAccount.bank_name,
                  bank_country: countryCode,
                  account_number: dto.bankAccount?.trim() || existingAccount.account_number,
                  swift: dto.swiftCode?.trim() || existingAccount.swift,
                  currency_code: defaultCurrency,
                },
              });
            } else if (dto.bankName && dto.bankAccount && this.prisma.partnerBankAccount?.create) {
              await this.prisma.partnerBankAccount.create({
                data: {
                  partner_id: partner.id,
                  bank_name: dto.bankName.trim(),
                  bank_country: countryCode,
                  account_number: dto.bankAccount.trim(),
                  swift: dto.swiftCode?.trim() || null,
                  currency_code: defaultCurrency,
                  is_default: true,
                },
              });
            }
          }

          if (dto.city || dto.postalCode || dto.address) {
            const existingAddress = await this.prisma.partnerAddress?.findFirst?.({
              where: { partner_id: partner.id },
            });
            if (existingAddress && this.prisma.partnerAddress?.update) {
              await this.prisma.partnerAddress.update({
                where: { id: existingAddress.id },
                data: {
                  address: dto.address?.trim() || existingAddress.address,
                  city: dto.city?.trim() || existingAddress.city,
                  postal_code: dto.postalCode?.trim() || existingAddress.postal_code,
                  country_code: countryCode,
                },
              });
            } else if (this.prisma.partnerAddress?.create) {
              await this.prisma.partnerAddress.create({
                data: {
                  partner_id: partner.id,
                  label: 'OFICINA_CENTRAL',
                  address: dto.address?.trim() || 'N/A',
                  city: dto.city?.trim() || null,
                  postal_code: dto.postalCode?.trim() || null,
                  country_code: countryCode,
                  is_default: true,
                },
              });
            }
          }

          if (dto.contactName) {
            const existingContact = await this.prisma.partnerContact?.findFirst?.({
              where: { partner_id: partner.id },
            });
            if (existingContact && this.prisma.partnerContact?.update) {
              await this.prisma.partnerContact.update({
                where: { id: existingContact.id },
                data: {
                  name: dto.contactName.trim(),
                  email: dto.email?.trim() || existingContact.email,
                  phone: dto.phone?.trim() || existingContact.phone,
                },
              });
            } else if (this.prisma.partnerContact?.create) {
              await this.prisma.partnerContact.create({
                data: {
                  partner_id: partner.id,
                  name: dto.contactName.trim(),
                  email: dto.email?.trim() || null,
                  phone: dto.phone?.trim() || null,
                  position: 'Ejecutivo Comercial Internacional',
                  is_primary: true,
                },
              });
            }
          }
        }
      } catch (err) {
        // No bloquear la creación del proveedor si la sincronización opcional falla
        console.warn('Error sincronizando ForeignSupplier con BusinessPartner:', err);
      }

      return supplier;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Ya existe un proveedor con ese tax ID en la empresa.');
      }
      throw error;
    }
  }

  async update(companyId: string, id: string, dto: ForeignSupplierDto) {
    const existing = await this.get(companyId, id);
    const updated = await this.prisma.foreignSupplier.update({
      where: { id },
      data: {
        ...(dto.taxId !== undefined ? { tax_id: dto.taxId?.trim() || null } : {}),
        ...(dto.businessName !== undefined ? { business_name: dto.businessName.trim() } : {}),
        ...(dto.countryCode !== undefined ? { country_code: dto.countryCode.toUpperCase() } : {}),
        ...(dto.defaultCurrency !== undefined ? { default_currency: dto.defaultCurrency.toUpperCase() } : {}),
        ...(dto.isRelated !== undefined ? { is_related: dto.isRelated } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.postalCode !== undefined ? { postal_code: dto.postalCode?.trim() || null } : {}),
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

    try {
      const lookupDoc = existing.tax_id || dto.taxId?.trim() || `EXT-${id.slice(0, 8)}`;
      const partner = await this.prisma.businessPartner?.findFirst?.({
        where: {
          company_id: companyId,
          doc_number: lookupDoc,
        },
      });

      if (partner && this.prisma.businessPartner?.update) {
        const mergedRoles = Array.from(new Set([...partner.roles, 'PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR']));
        await this.prisma.businessPartner.update({
          where: { id: partner.id },
          data: {
            ...(dto.businessName ? { legal_name: dto.businessName.trim(), trade_name: dto.businessName.trim() } : {}),
            ...(dto.countryCode ? { country_code: dto.countryCode.toUpperCase() } : {}),
            ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
            ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
            ...(dto.paymentTerms !== undefined ? { payment_terms: dto.paymentTerms?.trim() || null } : {}),
            ...(dto.defaultCurrency !== undefined ? { currency_code: dto.defaultCurrency.toUpperCase() } : {}),
            roles: mergedRoles,
          },
        });

        if (dto.bankName || dto.bankAccount || dto.swiftCode) {
          const bankAcc = await this.prisma.partnerBankAccount.findFirst({ where: { partner_id: partner.id } });
          if (bankAcc) {
            await this.prisma.partnerBankAccount.update({
              where: { id: bankAcc.id },
              data: {
                ...(dto.bankName ? { bank_name: dto.bankName.trim() } : {}),
                ...(dto.bankAccount ? { account_number: dto.bankAccount.trim() } : {}),
                ...(dto.swiftCode !== undefined ? { swift: dto.swiftCode?.trim() || null } : {}),
                ...(dto.countryCode ? { bank_country: dto.countryCode.toUpperCase() } : {}),
                ...(dto.defaultCurrency ? { currency_code: dto.defaultCurrency.toUpperCase() } : {}),
              },
            });
          } else if (dto.bankName && dto.bankAccount) {
            await this.prisma.partnerBankAccount.create({
              data: {
                partner_id: partner.id,
                bank_name: dto.bankName.trim(),
                bank_country: (dto.countryCode || partner.country_code).toUpperCase(),
                account_number: dto.bankAccount.trim(),
                swift: dto.swiftCode?.trim() || null,
                currency_code: (dto.defaultCurrency || partner.currency_code || 'USD').toUpperCase(),
                is_default: true,
              },
            });
          }
        }

        if (dto.city || dto.postalCode || dto.address) {
          const addr = await this.prisma.partnerAddress.findFirst({ where: { partner_id: partner.id } });
          if (addr) {
            await this.prisma.partnerAddress.update({
              where: { id: addr.id },
              data: {
                ...(dto.address !== undefined ? { address: dto.address?.trim() || addr.address } : {}),
                ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
                ...(dto.postalCode !== undefined ? { postal_code: dto.postalCode?.trim() || null } : {}),
                ...(dto.countryCode ? { country_code: dto.countryCode.toUpperCase() } : {}),
              },
            });
          } else {
            await this.prisma.partnerAddress.create({
              data: {
                partner_id: partner.id,
                label: 'OFICINA_CENTRAL',
                address: dto.address?.trim() || 'N/A',
                city: dto.city?.trim() || null,
                postal_code: dto.postalCode?.trim() || null,
                country_code: (dto.countryCode || partner.country_code).toUpperCase(),
                is_default: true,
              },
            });
          }
        }

        if (dto.contactName) {
          const cont = await this.prisma.partnerContact.findFirst({ where: { partner_id: partner.id } });
          if (cont) {
            await this.prisma.partnerContact.update({
              where: { id: cont.id },
              data: {
                name: dto.contactName.trim(),
                ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
              },
            });
          } else {
            await this.prisma.partnerContact.create({
              data: {
                partner_id: partner.id,
                name: dto.contactName.trim(),
                email: dto.email?.trim() || null,
                phone: dto.phone?.trim() || null,
                position: 'Ejecutivo Comercial Internacional',
                is_primary: true,
              },
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error sincronizando actualización con BusinessPartner:', err);
    }

    return updated;
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
