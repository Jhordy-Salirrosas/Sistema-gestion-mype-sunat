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

    return this.prisma.businessPartner.create({
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
        credit_limit: dto.creditLimit ?? null,
        currency_code: (dto.currencyCode ?? 'PEN').toUpperCase(),
      },
    });
  }

  async updatePartner(companyId: string, id: string, dto: UpdatePartnerDto) {
    await this.getPartner(companyId, id);

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
    if (dto.creditLimit !== undefined) data.credit_limit = dto.creditLimit;
    if (dto.currencyCode !== undefined) data.currency_code = dto.currencyCode.toUpperCase();
    if (dto.isActive !== undefined) data.is_active = dto.isActive;

    return this.prisma.businessPartner.update({
      where: { id },
      data: data as never,
    });
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
}
