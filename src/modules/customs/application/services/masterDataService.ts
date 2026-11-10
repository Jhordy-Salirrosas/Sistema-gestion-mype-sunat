import { Prisma, type BusinessPartner } from '../../../../generated/client/client';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  AddPartnerAddressDto,
  AddPartnerBankAccountDto,
  AddPartnerContactDto,
  CreateExchangeRateDto,
  CreatePartnerDto,
  UpdatePartnerDto,
  UpsertAccountingMappingDto,
  UpsertCurrencyDto,
  UpsertDocumentTypeDto,
  UpsertIncotermDto,
  UpsertCountryDto,
  UpsertPortDto,
  UpdateExchangeRateDto,
} from '../dto/masterDataDto';

/**
 * Maestros de la Fase 1.
 *
 * Vive dentro de customs para respetar el perímetro acordado: no se crea
 * un módulo nuevo ni se modifican invoices/accounting/sire.
 */
@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Monedas
  // -------------------------------------------------------------------------
  listCurrencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  upsertCurrency(dto: UpsertCurrencyDto) {
    const data = {
      name: dto.name,
      symbol: dto.symbol,
      decimals: dto.decimals ?? 2,
      is_active: dto.isActive ?? true,
    };
    return this.prisma.currency.upsert({
      where: { code: dto.code.toUpperCase() },
      update: data,
      create: { code: dto.code.toUpperCase(), ...data },
    });
  }

  // -------------------------------------------------------------------------
  // Tipos de cambio
  // -------------------------------------------------------------------------
  listExchangeRates() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async createExchangeRate(dto: CreateExchangeRateDto) {
    const base = dto.baseCurrency.toUpperCase();
    const quote = dto.quoteCurrency.toUpperCase();
    const date = new Date(dto.date);

    return this.prisma.exchangeRate.upsert({
      where: {
        base_currency_quote_currency_date: {
          base_currency: base,
          quote_currency: quote,
          date,
        },
      },
      update: { rate: dto.rate, source: dto.source ?? 'MANUAL' },
      create: {
        base_currency: base,
        quote_currency: quote,
        rate: dto.rate,
        date,
        source: dto.source ?? 'MANUAL',
      },
    });
  }

  async updateExchangeRate(id: string, dto: UpdateExchangeRateDto) {
    const existing = await this.prisma.exchangeRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de cambio no encontrado.');
    return this.prisma.exchangeRate.update({
      where: { id },
      data: {
        rate: dto.rate,
        ...(dto.source ? { source: dto.source } : {}),
      },
    });
  }

  async syncTodayExchangeRate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rate = 3.755;
    let source = 'SUNAT';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch('https://api.apis.net.pe/v1/tipo-cambio-sunat', { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = (await resp.json()) as { venta?: number; compra?: number };
        if (data?.venta) {
          rate = Number(data.venta);
          source = 'SUNAT';
        }
      }
    } catch {
      const last = await this.prisma.exchangeRate.findFirst({
        where: { base_currency: 'USD', quote_currency: 'PEN' },
        orderBy: { date: 'desc' },
      });
      if (last) {
        rate = Number(last.rate);
        source = last.source;
      }
    }

    return this.createExchangeRate({
      baseCurrency: 'USD',
      quoteCurrency: 'PEN',
      rate,
      date: today.toISOString(),
      source,
    });
  }

  // -------------------------------------------------------------------------
  // Incoterms
  // -------------------------------------------------------------------------
  listIncoterms() {
    return this.prisma.incoterm.findMany({ orderBy: { code: 'asc' } });
  }

  upsertIncoterm(dto: UpsertIncotermDto) {
    const data = {
      name: dto.name,
      version: dto.version ?? '2020',
      named_place_required: dto.namedPlaceRequired ?? true,
      is_active: dto.isActive ?? true,
    };
    return this.prisma.incoterm.upsert({
      where: { code: dto.code.toUpperCase() },
      update: data,
      create: { code: dto.code.toUpperCase(), ...data },
    });
  }

  // -------------------------------------------------------------------------
  // Clientes / proveedores
  // -------------------------------------------------------------------------
  listPartners(companyId: string, role?: string, q?: string) {
    const term = (q ?? '').trim();
    if (term) {
      // PostgreSQL normaliza también el dato almacenado: no se reescriben
      // terceros ni se requiere instalar una extensión o migrar el esquema.
      const fold = (value: Prisma.Sql) => Prisma.sql`
        regexp_replace(normalize(lower(${value}), NFD), ${'[\u0300-\u036f]'}, '', 'g')`;
      const needle = fold(Prisma.sql`${term}`);
      return this.prisma.$queryRaw<BusinessPartner[]>(Prisma.sql`
        SELECT * FROM business_partners
        WHERE company_id = ${companyId}
          ${role ? Prisma.sql`AND ${role.toUpperCase()} = ANY(roles)` : Prisma.empty}
          AND (
            strpos(${fold(Prisma.sql`legal_name`)}, ${needle}) > 0
            OR strpos(${fold(Prisma.sql`doc_number`)}, ${needle}) > 0
            OR strpos(${fold(Prisma.sql`COALESCE(trade_name, '')`)}, ${needle}) > 0
          )
        ORDER BY legal_name ASC
        LIMIT 200
      `);
    }
    return this.prisma.businessPartner.findMany({
      where: {
        company_id: companyId,
        ...(role ? { roles: { has: role.toUpperCase() } } : {}),
      },
      orderBy: { legal_name: 'asc' },
      take: 200,
    });
  }

  async getPartner(companyId: string, id: string) {
    const partner = await this.prisma.businessPartner.findFirst({
      where: { id, company_id: companyId },
      include: {
        addresses: { orderBy: { is_default: 'desc' } },
        contacts: { orderBy: { is_primary: 'desc' } },
        bank_accounts: { orderBy: { is_default: 'desc' } },
      },
    });
    if (!partner) throw new NotFoundException('Tercero no encontrado.');
    return partner;
  }

  async createPartner(companyId: string, dto: CreatePartnerDto) {
    const existing = await this.prisma.businessPartner.findFirst({
      where: {
        company_id: companyId,
        doc_type: dto.docType,
        doc_number: dto.docNumber,
      },
    });
    if (existing) {
      throw new ConflictException('Ya existe un tercero con ese documento.');
    }

    const partner = await this.prisma.businessPartner.create({
      data: {
        company_id: companyId,
        doc_type: dto.docType,
        doc_number: dto.docNumber,
        legal_name: dto.legalName,
        trade_name: dto.tradeName ?? null,
        country_code: (dto.countryCode ?? 'PE').toUpperCase(),
        address: dto.address ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        website: dto.website ?? null,
        roles: (dto.roles ?? []).map((r) => r.toUpperCase()),
        payment_terms: dto.paymentTerms ?? null,
        has_credit:
          dto.hasCredit !== undefined
            ? dto.hasCredit
            : dto.paymentTerms
              ? dto.paymentTerms !== 'CONTADO'
              : null,
        allows_discount:
          dto.allowsDiscount !== undefined ? dto.allowsDiscount : null,
        credit_limit: dto.creditLimit ?? null,
        currency_code: (dto.currencyCode ?? 'PEN').toUpperCase(),
      },
    });

    const country = (dto.countryCode ?? 'PE').toUpperCase();
    const currency = (dto.currencyCode ?? 'PEN').toUpperCase();

    if (dto.city || dto.postalCode || dto.address) {
      await this.prisma.partnerAddress.create({
        data: {
          partner_id: partner.id,
          label: 'OFICINA_CENTRAL',
          address: dto.address?.trim() || 'N/A',
          city: dto.city?.trim() || null,
          postal_code: dto.postalCode?.trim() || null,
          country_code: country,
          is_default: true,
        },
      });
    }

    if (dto.contactName) {
      await this.prisma.partnerContact.create({
        data: {
          partner_id: partner.id,
          name: dto.contactName.trim(),
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          position: 'Contacto Comercial',
          is_primary: true,
        },
      });
    }

    if (dto.bankName || dto.accountNumber || dto.swiftCode) {
      await this.prisma.partnerBankAccount.create({
        data: {
          partner_id: partner.id,
          bank_name: dto.bankName?.trim() || 'Banco',
          bank_country: country,
          account_number: dto.accountNumber?.trim() || '-',
          swift: dto.swiftCode?.trim() || null,
          currency_code: currency,
          is_default: true,
        },
      });
    }

    // Si es del exterior o importador, sincronizar también en foreign_suppliers
    const rolesUpper = (dto.roles ?? []).map((r) => r.toUpperCase());
    if (rolesUpper.includes('IMPORTADOR') || rolesUpper.includes('PROVEEDOR_EXTERIOR') || country !== 'PE') {
      const supplierData = {
        business_name: dto.legalName,
        country_code: country,
        city: dto.city?.trim() || null,
        postal_code: dto.postalCode?.trim() || null,
        address: dto.address?.trim() || null,
        contact_name: dto.contactName?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        payment_terms: dto.paymentTerms?.trim() || null,
        bank_name: dto.bankName?.trim() || null,
        bank_account: dto.accountNumber?.trim() || null,
        swift_code: dto.swiftCode?.trim() || null,
        default_currency: currency,
      };
      try {
        await this.prisma.foreignSupplier.upsert({
          where: {
            company_id_tax_id: {
              company_id: companyId,
              tax_id: dto.docNumber,
            },
          },
          update: supplierData,
          create: {
            company_id: companyId,
            tax_id: dto.docNumber,
            ...supplierData,
          },
        });
      } catch (err) {
        console.warn('Advertencia al sincronizar con ForeignSupplier:', err);
      }
    }

    return partner;
  }

  async updatePartner(companyId: string, id: string, dto: UpdatePartnerDto) {
    const existing = await this.getPartner(companyId, id);

    const data: Record<string, unknown> = {};
    if (dto.legalName !== undefined) data.legal_name = dto.legalName;
    if (dto.tradeName !== undefined) data.trade_name = dto.tradeName;
    if (dto.countryCode !== undefined) data.country_code = dto.countryCode.toUpperCase();
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.roles !== undefined) data.roles = dto.roles.map((r) => r.toUpperCase());
    if (dto.paymentTerms !== undefined) data.payment_terms = dto.paymentTerms;
    if (dto.hasCredit !== undefined) data.has_credit = dto.hasCredit;
    else if (dto.paymentTerms !== undefined) {
      data.has_credit = dto.paymentTerms ? dto.paymentTerms !== 'CONTADO' : null;
    }
    if (dto.allowsDiscount !== undefined) data.allows_discount = dto.allowsDiscount;
    if (dto.creditLimit !== undefined) data.credit_limit = dto.creditLimit;
    if (dto.currencyCode !== undefined) data.currency_code = dto.currencyCode.toUpperCase();
    if (dto.isActive !== undefined) data.is_active = dto.isActive;

    const updated = await this.prisma.businessPartner.update({
      where: { id },
      data: data as never,
    });

    const targetCountry = (dto.countryCode ?? existing.country_code ?? 'PE').toUpperCase();
    const targetCurrency = (dto.currencyCode ?? existing.currency_code ?? 'PEN').toUpperCase();

    // Actualizar o crear dirección principal con ciudad / código postal
    if (dto.city !== undefined || dto.postalCode !== undefined || dto.address !== undefined) {
      const existingAddress = await this.prisma.partnerAddress?.findFirst?.({
        where: { partner_id: id },
      });
      if (existingAddress && this.prisma.partnerAddress?.update) {
        await this.prisma.partnerAddress.update({
          where: { id: existingAddress.id },
          data: {
            ...(dto.address !== undefined ? { address: dto.address?.trim() || existingAddress.address } : {}),
            ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
            ...(dto.postalCode !== undefined ? { postal_code: dto.postalCode?.trim() || null } : {}),
            country_code: targetCountry,
          },
        });
      } else if ((dto.city || dto.postalCode || dto.address) && this.prisma.partnerAddress?.create) {
        await this.prisma.partnerAddress.create({
          data: {
            partner_id: id,
            label: 'OFICINA_CENTRAL',
            address: dto.address?.trim() || existing.address || 'N/A',
            city: dto.city?.trim() || null,
            postal_code: dto.postalCode?.trim() || null,
            country_code: targetCountry,
            is_default: true,
          },
        });
      }
    }

    // Actualizar o crear contacto comercial
    if (dto.contactName !== undefined || dto.email !== undefined || dto.phone !== undefined) {
      const existingContact = await this.prisma.partnerContact?.findFirst?.({
        where: { partner_id: id },
      });
      if (existingContact && this.prisma.partnerContact?.update) {
        await this.prisma.partnerContact.update({
          where: { id: existingContact.id },
          data: {
            ...(dto.contactName !== undefined ? { name: dto.contactName.trim() } : {}),
            ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          },
        });
      } else if (dto.contactName && this.prisma.partnerContact?.create) {
        await this.prisma.partnerContact.create({
          data: {
            partner_id: id,
            name: dto.contactName.trim(),
            email: dto.email?.trim() || existing.email || null,
            phone: dto.phone?.trim() || existing.phone || null,
            position: 'Contacto Comercial',
            is_primary: true,
          },
        });
      }
    }

    // Actualizar o crear cuenta bancaria
    if (dto.bankName !== undefined || dto.accountNumber !== undefined || dto.swiftCode !== undefined) {
      const existingBank = await this.prisma.partnerBankAccount?.findFirst?.({
        where: { partner_id: id },
      });
      if (existingBank && this.prisma.partnerBankAccount?.update) {
        await this.prisma.partnerBankAccount.update({
          where: { id: existingBank.id },
          data: {
            ...(dto.bankName !== undefined ? { bank_name: dto.bankName.trim() } : {}),
            ...(dto.accountNumber !== undefined ? { account_number: dto.accountNumber.trim() } : {}),
            ...(dto.swiftCode !== undefined ? { swift: dto.swiftCode?.trim() || null } : {}),
            bank_country: targetCountry,
            currency_code: targetCurrency,
          },
        });
      } else if ((dto.bankName || dto.accountNumber || dto.swiftCode) && this.prisma.partnerBankAccount?.create) {
        await this.prisma.partnerBankAccount.create({
          data: {
            partner_id: id,
            bank_name: dto.bankName?.trim() || 'Banco',
            bank_country: targetCountry,
            account_number: dto.accountNumber?.trim() || '-',
            swift: dto.swiftCode?.trim() || null,
            currency_code: targetCurrency,
            is_default: true,
          },
        });
      }
    }

    // Sincronizar en foreign_suppliers si existe tax_id coincidente
    try {
      const foreign = await this.prisma.foreignSupplier?.findFirst?.({
        where: {
          company_id: companyId,
          tax_id: existing.doc_number,
        },
      });
      if (foreign && this.prisma.foreignSupplier?.update) {
        await this.prisma.foreignSupplier.update({
          where: { id: foreign.id },
          data: {
            ...(dto.legalName ? { business_name: dto.legalName.trim() } : {}),
            ...(dto.countryCode ? { country_code: dto.countryCode.toUpperCase() } : {}),
            ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
            ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
            ...(dto.postalCode !== undefined ? { postal_code: dto.postalCode?.trim() || null } : {}),
            ...(dto.contactName !== undefined ? { contact_name: dto.contactName?.trim() || null } : {}),
            ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
            ...(dto.paymentTerms !== undefined ? { payment_terms: dto.paymentTerms?.trim() || null } : {}),
            ...(dto.bankName !== undefined ? { bank_name: dto.bankName?.trim() || null } : {}),
            ...(dto.accountNumber !== undefined ? { bank_account: dto.accountNumber?.trim() || null } : {}),
            ...(dto.swiftCode !== undefined ? { swift_code: dto.swiftCode?.trim() || null } : {}),
            ...(dto.currencyCode !== undefined ? { default_currency: dto.currencyCode.toUpperCase() } : {}),
          },
        });
      }
    } catch (err) {
      console.warn('Advertencia al sincronizar actualización con ForeignSupplier:', err);
    }

    return updated;
  }

  async getPartnerTaxStatus(companyId: string, partnerId: string) {
    await this.getPartner(companyId, partnerId);
    const hoy = new Date();
    const rows = await this.prisma.partnerTaxStatus.findMany({
      where: {
        partner_id: partnerId,
        valid_from: { lte: hoy },
        OR: [{ valid_to: null }, { valid_to: { gte: hoy } }],
      },
      orderBy: [{ indicator: 'asc' }, { valid_from: 'desc' }],
    });
    return rows;
  }

  async upsertPartnerTaxStatus(
    companyId: string,
    partnerId: string,
    dto: { indicator: string; value: boolean; validFrom: string; validTo?: string; source?: string; updatedBy?: string },
  ) {
    await this.getPartner(companyId, partnerId);
    const validFrom = new Date(dto.validFrom);
    await this.prisma.$transaction([
      this.prisma.partnerTaxStatus.updateMany({
        where: {
          partner_id: partnerId,
          indicator: dto.indicator as never,
          valid_to: null,
        },
        data: { valid_to: validFrom },
      }),
      this.prisma.partnerTaxStatus.create({
        data: {
          partner_id: partnerId,
          indicator: dto.indicator as never,
          value: dto.value,
          valid_from: validFrom,
          valid_to: dto.validTo ? new Date(dto.validTo) : null,
          source: dto.source ?? 'MANUAL',
          updated_by: dto.updatedBy ?? null,
        },
      }),
    ]);
    return this.getPartnerTaxStatus(companyId, partnerId);
  }

  async addAddress(companyId: string, partnerId: string, dto: AddPartnerAddressDto) {
    await this.getPartner(companyId, partnerId);
    return this.prisma.partnerAddress.create({
      data: {
        partner_id: partnerId,
        label: dto.label ?? 'PRINCIPAL',
        address: dto.address,
        city: dto.city ?? null,
        state: dto.state ?? null,
        country_code: (dto.countryCode ?? 'PE').toUpperCase(),
        postal_code: dto.postalCode ?? null,
        is_default: dto.isDefault ?? false,
      },
    });
  }

  async addContact(companyId: string, partnerId: string, dto: AddPartnerContactDto) {
    await this.getPartner(companyId, partnerId);
    return this.prisma.partnerContact.create({
      data: {
        partner_id: partnerId,
        name: dto.name,
        position: dto.position ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        is_primary: dto.isPrimary ?? false,
      },
    });
  }

  async addBankAccount(
    companyId: string,
    partnerId: string,
    dto: AddPartnerBankAccountDto,
  ) {
    await this.getPartner(companyId, partnerId);
    return this.prisma.partnerBankAccount.create({
      data: {
        partner_id: partnerId,
        bank_name: dto.bankName,
        bank_country: (dto.bankCountry ?? 'PE').toUpperCase(),
        account_number: dto.accountNumber,
        cci: dto.cci ?? null,
        swift: dto.swift ?? null,
        iban: dto.iban ?? null,
        beneficiary: dto.beneficiary ?? null,
        currency_code: (dto.currencyCode ?? 'PEN').toUpperCase(),
        is_default: dto.isDefault ?? false,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Tipos de documento
  // -------------------------------------------------------------------------
  listDocumentTypes() {
    return this.prisma.documentType.findMany({ orderBy: { code: 'asc' } });
  }

  upsertDocumentType(dto: UpsertDocumentTypeDto) {
    const data = {
      name: dto.name,
      stage: dto.stage ?? 'GENERAL',
      is_required: dto.isRequired ?? false,
      allowed_formats: dto.allowedFormats ?? [],
      is_active: dto.isActive ?? true,
    };
    return this.prisma.documentType.upsert({
      where: { code: dto.code.toUpperCase() },
      update: data,
      create: { code: dto.code.toUpperCase(), ...data },
    });
  }

  // -------------------------------------------------------------------------
  // Mapeo contable
  // -------------------------------------------------------------------------
  listAccountingMappings(companyId: string) {
    return this.prisma.accountingMapping.findMany({
      where: { company_id: companyId },
      orderBy: [{ process_code: 'asc' }, { role_code: 'asc' }],
    });
  }

  upsertAccountingMapping(companyId: string, dto: UpsertAccountingMappingDto) {
    const processCode = dto.processCode.toUpperCase();
    const roleCode = dto.roleCode.toUpperCase();
    return this.prisma.accountingMapping.upsert({
      where: {
        company_id_process_code_role_code: {
          company_id: companyId,
          process_code: processCode,
          role_code: roleCode,
        },
      },
      update: {
        account_code: dto.accountCode,
        is_active: dto.isActive ?? true,
      },
      create: {
        company_id: companyId,
        process_code: processCode,
        role_code: roleCode,
        account_code: dto.accountCode,
        is_active: dto.isActive ?? true,
      },
    });
  }

  async deletePartner(companyId: string, id: string) {
    await this.getPartner(companyId, id);
    await this.prisma.partnerAddress.deleteMany({ where: { partner_id: id } });
    await this.prisma.partnerContact.deleteMany({ where: { partner_id: id } });
    await this.prisma.partnerBankAccount.deleteMany({ where: { partner_id: id } });
    return this.prisma.businessPartner.delete({ where: { id } });
  }

  async deleteCurrency(code: string) {
    return this.prisma.currency.delete({ where: { code: code.toUpperCase() } });
  }

  async deleteExchangeRate(id: string) {
    return this.prisma.exchangeRate.delete({ where: { id } });
  }

  async deleteIncoterm(code: string) {
    return this.prisma.incoterm.delete({ where: { code: code.toUpperCase() } });
  }

  async deleteDocumentType(code: string) {
    return this.prisma.documentType.delete({ where: { code: code.toUpperCase() } });
  }

  // -------------------------------------------------------------------------
  // Países
  // -------------------------------------------------------------------------
  listCountries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  upsertCountry(dto: UpsertCountryDto) {
    const code = dto.code.trim().toUpperCase();
    const data = {
      name: dto.name.trim(),
      status: (dto.status ?? 'ACTIVO').toUpperCase(),
    };
    return this.prisma.country.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
  }

  async deleteCountry(code: string) {
    return this.prisma.country.delete({ where: { code: code.trim().toUpperCase() } });
  }

  // -------------------------------------------------------------------------
  // Puertos
  // -------------------------------------------------------------------------
  listPorts(type?: string) {
    const filterType = type?.trim().toUpperCase();
    return this.prisma.port.findMany({
      where: filterType && filterType !== 'TODOS' ? {
        OR: [
          { type: filterType },
          { type: 'AMBOS' },
        ],
      } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  upsertPort(dto: UpsertPortDto) {
    const code = dto.code.trim().toUpperCase();
    const data = {
      name: dto.name.trim(),
      country_code: (dto.countryCode ?? 'PE').trim().toUpperCase(),
      type: (dto.type ?? 'AMBOS').trim().toUpperCase(),
      status: (dto.status ?? 'ACTIVO').trim().toUpperCase(),
    };
    return this.prisma.port.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
  }

  async deletePort(code: string) {
    return this.prisma.port.delete({ where: { code: code.trim().toUpperCase() } });
  }
}
