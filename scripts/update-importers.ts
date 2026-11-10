import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client/client';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Verificando y actualizando importadores / proveedores ---');

  const company = await prisma.company.findFirst({
    where: { ruc: '20601234567' },
  });

  if (!company) {
    console.error('No se encontró la empresa demo 20601234567');
    return;
  }

  const suppliers = [
    {
      taxId: 'CN91440300MA5XYZ12',
      legalName: 'Shenzhen Construction Supplies Ltd.',
      tradeName: 'Shenzhen Supplies',
      countryCode: 'CN',
      city: 'Shenzhen',
      postalCode: '518000',
      address: 'Bao’an District, Shenzhen, China',
      contactName: 'Wei Zhang',
      email: 'sales@shenzhen-supplies.cn',
      phone: '+86 755 8888 1234',
      paymentTerms: '30_DIAS',
      bankName: 'Bank of China',
      bankAccount: 'BOC-CN-9876543210',
      swiftCode: 'BKCHCNBJ',
      currency: 'USD',
      portOrigin: 'CNSHA',
    },
    {
      taxId: 'US942857193',
      legalName: 'Silicon Valley Components Inc.',
      tradeName: 'SV Components',
      countryCode: 'US',
      city: 'San Jose',
      postalCode: '95110',
      address: '100 Innovation Way, Suite 300',
      contactName: 'Sarah Miller',
      email: 'orders@svcomponents.com',
      phone: '+1 408 555 0199',
      paymentTerms: '30_DIAS',
      bankName: 'JPMorgan Chase Bank',
      bankAccount: 'CHASE-US-123456789',
      swiftCode: 'CHASUS33',
      currency: 'USD',
      portOrigin: 'USMIA',
    },
    {
      taxId: 'DE301948275',
      legalName: 'Hamburg Logistics & Spare Parts GmbH',
      tradeName: 'Hamburg Logistics',
      countryCode: 'DE',
      city: 'Hamburg',
      postalCode: '20457',
      address: 'Am Sandtorkai 48',
      contactName: 'Hans Weber',
      email: 'kontakt@hamburglogistics.de',
      phone: '+49 40 3344 5500',
      paymentTerms: '60_DIAS',
      bankName: 'Deutsche Bank AG',
      bankAccount: 'DE89370400440532013000',
      swiftCode: 'DEUTDEDD',
      currency: 'EUR',
      portOrigin: 'DEHAM',
    },
    {
      taxId: 'TW53892014',
      legalName: 'Taipei Semiconductor Group Co.',
      tradeName: 'Taipei Semi',
      countryCode: 'TW',
      city: 'Taipei',
      postalCode: '110',
      address: 'No. 7, Section 5, Xinyi Road',
      contactName: 'Ching-Hua Lin',
      email: 'export@taipeisemi.tw',
      phone: '+886 2 8101 8888',
      paymentTerms: 'CONTADO',
      bankName: 'CTBC Bank Co., Ltd.',
      bankAccount: 'CTBC-TW-456789012',
      swiftCode: 'CTBCTWTP',
      currency: 'USD',
      portOrigin: 'TWKHH',
    },
  ];

  for (const s of suppliers) {
    // 1. Actualizar o crear ForeignSupplier
    await prisma.foreignSupplier.upsert({
      where: {
        company_id_tax_id: {
          company_id: company.id,
          tax_id: s.taxId,
        },
      },
      update: {
        business_name: s.legalName,
        country_code: s.countryCode,
        city: s.city,
        postal_code: s.postalCode,
        address: s.address,
        contact_name: s.contactName,
        email: s.email,
        phone: s.phone,
        payment_terms: s.paymentTerms,
        bank_name: s.bankName,
        bank_account: s.bankAccount,
        swift_code: s.swiftCode,
        default_currency: s.currency,
        port_origin: s.portOrigin,
      },
      create: {
        company_id: company.id,
        tax_id: s.taxId,
        business_name: s.legalName,
        country_code: s.countryCode,
        city: s.city,
        postal_code: s.postalCode,
        address: s.address,
        contact_name: s.contactName,
        email: s.email,
        phone: s.phone,
        payment_terms: s.paymentTerms,
        bank_name: s.bankName,
        bank_account: s.bankAccount,
        swift_code: s.swiftCode,
        default_currency: s.currency,
        port_origin: s.portOrigin,
      },
    });

    // 2. Actualizar o crear BusinessPartner con roles PROVEEDOR, PROVEEDOR_EXTERIOR, IMPORTADOR
    // Puede estar registrado con doc_type '0' o '6'
    let partner = await prisma.businessPartner.findFirst({
      where: {
        company_id: company.id,
        doc_number: s.taxId,
      },
    });

    const roles = ['PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR'];

    if (partner) {
      const mergedRoles = Array.from(new Set([...partner.roles, ...roles]));
      partner = await prisma.businessPartner.update({
        where: { id: partner.id },
        data: {
          legal_name: s.legalName,
          trade_name: s.tradeName,
          country_code: s.countryCode,
          roles: mergedRoles,
          address: s.address,
          email: s.email,
          phone: s.phone,
          payment_terms: s.paymentTerms,
          currency_code: s.currency,
        },
      });
    } else {
      partner = await prisma.businessPartner.create({
        data: {
          company_id: company.id,
          doc_type: '0',
          doc_number: s.taxId,
          legal_name: s.legalName,
          trade_name: s.tradeName,
          country_code: s.countryCode,
          roles,
          address: s.address,
          email: s.email,
          phone: s.phone,
          payment_terms: s.paymentTerms,
          currency_code: s.currency,
        },
      });
    }

    // 3. Dirección con ciudad y código postal
    const existingAddress = await prisma.partnerAddress.findFirst({
      where: { partner_id: partner.id },
    });
    if (existingAddress) {
      await prisma.partnerAddress.update({
        where: { id: existingAddress.id },
        data: {
          address: s.address,
          city: s.city,
          postal_code: s.postalCode,
          country_code: s.countryCode,
        },
      });
    } else {
      await prisma.partnerAddress.create({
        data: {
          partner_id: partner.id,
          label: 'OFICINA_CENTRAL',
          address: s.address,
          city: s.city,
          postal_code: s.postalCode,
          country_code: s.countryCode,
          is_default: true,
        },
      });
    }

    // 4. Contacto comercial
    const existingContact = await prisma.partnerContact.findFirst({
      where: { partner_id: partner.id },
    });
    if (existingContact) {
      await prisma.partnerContact.update({
        where: { id: existingContact.id },
        data: {
          name: s.contactName,
          email: s.email,
          phone: s.phone,
          position: 'Ejecutivo Comercial Internacional',
        },
      });
    } else {
      await prisma.partnerContact.create({
        data: {
          partner_id: partner.id,
          name: s.contactName,
          email: s.email,
          phone: s.phone,
          position: 'Ejecutivo Comercial Internacional',
          is_primary: true,
        },
      });
    }

    // 5. Cuenta bancaria con SWIFT
    const existingBank = await prisma.partnerBankAccount.findFirst({
      where: { partner_id: partner.id },
    });
    if (existingBank) {
      await prisma.partnerBankAccount.update({
        where: { id: existingBank.id },
        data: {
          bank_name: s.bankName,
          bank_country: s.countryCode,
          account_number: s.bankAccount,
          swift: s.swiftCode,
          currency_code: s.currency,
        },
      });
    } else {
      await prisma.partnerBankAccount.create({
        data: {
          partner_id: partner.id,
          bank_name: s.bankName,
          bank_country: s.countryCode,
          account_number: s.bankAccount,
          swift: s.swiftCode,
          currency_code: s.currency,
          is_default: true,
        },
      });
    }

    console.log(`✓ Sincronizado ${s.legalName} (${s.countryCode}) con roles: ${roles.join(', ')}`);
  }

  // Verificar cuántos importadores existen ahora en business_partners
  const importers = await prisma.businessPartner.findMany({
    where: {
      company_id: company.id,
      roles: { has: 'IMPORTADOR' },
    },
    select: {
      id: true,
      legal_name: true,
      country_code: true,
      roles: true,
    },
  });

  console.log(`\nTotal terceros con rol IMPORTADOR: ${importers.length}`);
  for (const imp of importers) {
    console.log(` - ${imp.legal_name} (${imp.country_code}) -> [${imp.roles.join(', ')}]`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

