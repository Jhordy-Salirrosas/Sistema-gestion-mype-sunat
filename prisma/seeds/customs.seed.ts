import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PrismaClient } from '../../src/generated/client/client';

export async function seedCustoms(prisma: PrismaClient) {
  console.log('--- Iniciando Seeding de Módulo 3 (Aduanas e Importaciones) ---');

  // 1. Ingesta de Agencias de Aduana Habilitadas desde Agente.txt
  const agentesPath = path.join(
    __dirname,
    '../../docs/importaciones/archivosTxT/Agente.txt',
  );

  if (fs.existsSync(agentesPath)) {
    const rawContent = fs.readFileSync(agentesPath, 'utf-8');
    const lines = rawContent.split(/\r?\n/);

    const brokerMap = new Map<
      string,
      { broker_code: string; business_name: string; jurisdiction: string; mandate_active: boolean }
    >();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('\t');
      if (parts.length >= 4) {
        const codigo = parts[0].trim();
        const agencia = parts[1].trim();
        const jurisdiccion = parts[2].trim();
        const estado = parts[3].trim();

        if (estado.toUpperCase().includes('HABILITADO') && codigo.length > 0) {
          // Si ya existe, priorizar Marítima del Callao o Lima
          if (!brokerMap.has(codigo)) {
            brokerMap.set(codigo, {
              broker_code: codigo,
              business_name: agencia,
              jurisdiction: jurisdiccion,
              mandate_active: true,
            });
          } else if (
            jurisdiccion.toUpperCase().includes('CALLAO') ||
            jurisdiccion.toUpperCase().includes('LIMA')
          ) {
            brokerMap.set(codigo, {
              broker_code: codigo,
              business_name: agencia,
              jurisdiction: jurisdiccion,
              mandate_active: true,
            });
          }
        }
      }
    }

    const brokersToInsert = Array.from(brokerMap.values());
    console.log(
      `Agentes de aduana habilitados identificados en Agente.txt: ${brokersToInsert.length}`,
    );

    // Inserción en bloques de 100 para optimizar Supabase Free Tier
    const chunkSize = 100;
    for (let i = 0; i < brokersToInsert.length; i += chunkSize) {
      const chunk = brokersToInsert.slice(i, i + chunkSize);
      await prisma.customsBroker.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }
    console.log(`✓ Agencias de aduanas persistidas exitosamente en customs_brokers.`);
  } else {
    console.warn(`Archivo Agente.txt no encontrado en ruta: ${agentesPath}`);
  }

  // 2. Ingesta de Países y Puertos para Comercio Exterior
  const demoCountries = [
    { code: 'PE', name: 'Perú', status: 'ACTIVO' },
    { code: 'CN', name: 'China', status: 'ACTIVO' },
    { code: 'US', name: 'Estados Unidos', status: 'ACTIVO' },
    { code: 'DE', name: 'Alemania', status: 'ACTIVO' },
    { code: 'JP', name: 'Japón', status: 'ACTIVO' },
    { code: 'TW', name: 'Taiwán', status: 'ACTIVO' },
    { code: 'KR', name: 'Corea del Sur', status: 'ACTIVO' },
    { code: 'BR', name: 'Brasil', status: 'ACTIVO' },
    { code: 'ES', name: 'España', status: 'ACTIVO' },
    { code: 'CL', name: 'Chile', status: 'ACTIVO' },
    { code: 'CO', name: 'Colombia', status: 'ACTIVO' },
    { code: 'MX', name: 'México', status: 'ACTIVO' },
    { code: 'IN', name: 'India', status: 'ACTIVO' },
    { code: 'VN', name: 'Vietnam', status: 'ACTIVO' },
    { code: 'IT', name: 'Italia', status: 'ACTIVO' },
  ];

  for (const c of demoCountries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, status: c.status },
      create: c,
    });
  }
  console.log(`✓ Catálogo de países verificado y persistido en countries.`);

  const demoPorts = [
    { code: 'PECLL', name: 'Puerto del Callao (Marítimo)', country_code: 'PE', type: 'DESTINO', status: 'ACTIVO' },
    { code: 'PEPAI', name: 'Puerto de Paita (Marítimo)', country_code: 'PE', type: 'DESTINO', status: 'ACTIVO' },
    { code: 'PECHY', name: 'Megapuerto de Chancay (Marítimo)', country_code: 'PE', type: 'DESTINO', status: 'ACTIVO' },
    { code: 'PEMAT', name: 'Puerto de Matarani (Marítimo)', country_code: 'PE', type: 'DESTINO', status: 'ACTIVO' },
    { code: 'PELIM', name: 'Aeropuerto Internacional Jorge Chávez (Aéreo)', country_code: 'PE', type: 'AMBOS', status: 'ACTIVO' },
    { code: 'CNSHA', name: 'Puerto de Shanghai (Marítimo)', country_code: 'CN', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'CNNGB', name: 'Puerto de Ningbo-Zhoushan (Marítimo)', country_code: 'CN', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'CNSZX', name: 'Puerto de Shenzhen (Yantian/Shekou)', country_code: 'CN', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'CNCAN', name: 'Puerto de Guangzhou (Nansha)', country_code: 'CN', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'CNTAO', name: 'Puerto de Qingdao (Marítimo)', country_code: 'CN', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'USMIA', name: 'Puerto de Miami (Marítimo/Aéreo)', country_code: 'US', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'USLAX', name: 'Puerto de Los Angeles / Long Beach', country_code: 'US', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'DEHAM', name: 'Puerto de Hamburgo (Marítimo)', country_code: 'DE', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'TWKHH', name: 'Puerto de Kaohsiung (Marítimo)', country_code: 'TW', type: 'ORIGEN', status: 'ACTIVO' },
    { code: 'KRPUS', name: 'Puerto de Busan (Marítimo)', country_code: 'KR', type: 'ORIGEN', status: 'ACTIVO' },
  ];

  for (const p of demoPorts) {
    await prisma.port.upsert({
      where: { code: p.code },
      update: { name: p.name, country_code: p.country_code, type: p.type, status: p.status },
      create: p,
    });
  }
  console.log(`✓ Catálogo de puertos verificado y persistido en ports.`);

  // 3. Ingesta de Proveedores Internacionales Frecuentes con Información Completa
  const company = await prisma.company.findFirst({
    where: { ruc: '20601234567' },
  });

  if (company) {
    const demoSuppliers = [
      {
        tax_id: 'CN91440300MA5XYZ12',
        business_name: 'Shenzhen Tech Global Ltd.',
        country_code: 'CN',
        city: 'Shenzhen',
        postal_code: '518000',
        address: 'Building 4, High-Tech Industrial Park, Nanshan',
        contact_name: 'Wei Zhang',
        email: 'sales@shenzhentech.cn',
        phone: '+86 755 8888 1234',
        payment_terms: 'CARTA_CREDITO',
        bank_name: 'Bank of China',
        bank_account: 'BOC-CN-9876543210',
        swift_code: 'BKCHCNBJ',
        port_origin: 'CNSHA',
        default_currency: 'USD',
        is_related: false,
      },
      {
        tax_id: 'US942857193',
        business_name: 'Silicon Valley Components Inc.',
        country_code: 'US',
        city: 'San Jose',
        postal_code: '95110',
        address: '100 Innovation Way, Suite 300',
        contact_name: 'Sarah Miller',
        email: 'orders@svcomponents.com',
        phone: '+1 408 555 0199',
        payment_terms: '30_DIAS',
        bank_name: 'JPMorgan Chase Bank',
        bank_account: 'CHASE-US-123456789',
        swift_code: 'CHASUS33',
        port_origin: 'USMIA',
        default_currency: 'USD',
        is_related: false,
      },
      {
        tax_id: 'DE301948275',
        business_name: 'Hamburg Logistics & Spare Parts GmbH',
        country_code: 'DE',
        city: 'Hamburg',
        postal_code: '20457',
        address: 'Am Sandtorkai 48',
        contact_name: 'Hans Weber',
        email: 'kontakt@hamburglogistics.de',
        phone: '+49 40 3344 5500',
        payment_terms: '60_DIAS',
        bank_name: 'Deutsche Bank AG',
        bank_account: 'DE89370400440532013000',
        swift_code: 'DEUTDEDD',
        port_origin: 'DEHAM',
        default_currency: 'EUR',
        is_related: false,
      },
      {
        tax_id: 'TW53892014',
        business_name: 'Taipei Semiconductor Group Co.',
        country_code: 'TW',
        city: 'Taipei',
        postal_code: '110',
        address: 'No. 7, Section 5, Xinyi Road',
        contact_name: 'Ching-Hua Lin',
        email: 'export@taipeisemi.tw',
        phone: '+886 2 8101 8888',
        payment_terms: 'CONTADO',
        bank_name: 'CTBC Bank Co., Ltd.',
        bank_account: 'CTBC-TW-456789012',
        swift_code: 'CTBCTWTP',
        port_origin: 'TWKHH',
        default_currency: 'USD',
        is_related: false,
      },
    ];

    for (const sup of demoSuppliers) {
      // 3.1 Registrar en foreign_suppliers
      await prisma.foreignSupplier.upsert({
        where: {
          company_id_tax_id: {
            company_id: company.id,
            tax_id: sup.tax_id,
          },
        },
        update: {
          business_name: sup.business_name,
          country_code: sup.country_code,
          city: sup.city,
          postal_code: sup.postal_code,
          address: sup.address,
          contact_name: sup.contact_name,
          email: sup.email,
          phone: sup.phone,
          payment_terms: sup.payment_terms,
          bank_name: sup.bank_name,
          bank_account: sup.bank_account,
          swift_code: sup.swift_code,
          port_origin: sup.port_origin,
          default_currency: sup.default_currency,
        },
        create: {
          company_id: company.id,
          ...sup,
        },
      });

      // 3.2 Sincronizar en business_partners (módulo Facturación / Compras)
      const partner = await prisma.businessPartner.upsert({
        where: {
          company_id_doc_type_doc_number: {
            company_id: company.id,
            doc_type: '0',
            doc_number: sup.tax_id,
          },
        },
        update: {
          legal_name: sup.business_name,
          trade_name: sup.business_name,
          country_code: sup.country_code,
          roles: ['PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR'],
          currency_code: sup.default_currency,
          payment_terms: sup.payment_terms,
          address: sup.address,
          email: sup.email,
          phone: sup.phone,
        },
        create: {
          company_id: company.id,
          doc_type: '0',
          doc_number: sup.tax_id,
          legal_name: sup.business_name,
          trade_name: sup.business_name,
          country_code: sup.country_code,
          roles: ['PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR'],
          currency_code: sup.default_currency,
          payment_terms: sup.payment_terms,
          address: sup.address,
          email: sup.email,
          phone: sup.phone,
        },
      });

      if (sup.bank_name && sup.bank_account) {
        const existingAcc = await prisma.partnerBankAccount.findFirst({
          where: { partner_id: partner.id },
        });
        if (!existingAcc) {
          await prisma.partnerBankAccount.create({
            data: {
              partner_id: partner.id,
              bank_name: sup.bank_name,
              bank_country: sup.country_code,
              account_number: sup.bank_account,
              swift: sup.swift_code,
              currency_code: sup.default_currency,
              is_default: true,
            },
          });
        }
      }

      if (sup.city || sup.postal_code || sup.address) {
        const existingAddress = await prisma.partnerAddress.findFirst({
          where: { partner_id: partner.id },
        });
        if (!existingAddress) {
          await prisma.partnerAddress.create({
            data: {
              partner_id: partner.id,
              label: 'OFICINA_CENTRAL',
              address: sup.address || 'N/A',
              city: sup.city,
              postal_code: sup.postal_code,
              country_code: sup.country_code,
              is_default: true,
            },
          });
        }
      }

      if (sup.contact_name) {
        const existingContact = await prisma.partnerContact.findFirst({
          where: { partner_id: partner.id },
        });
        if (!existingContact) {
          await prisma.partnerContact.create({
            data: {
              partner_id: partner.id,
              name: sup.contact_name,
              email: sup.email,
              phone: sup.phone,
              position: 'Ejecutivo Comercial Internacional',
              is_primary: true,
            },
          });
        }
      }
    }
    console.log(`✓ Proveedores internacionales sincronizados en foreign_suppliers y business_partners.`);
  }

  if (company) {
    const supplier = await prisma.foreignSupplier.findFirst({
      where: { country_code: 'CN' },
    });
    const broker = await prisma.customsBroker.findFirst({
      where: { broker_code: '0014' },
    });

    const existingShipment = await prisma.customsShipment.findFirst({
      where: {
        company_id: company.id,
        shipment_number: 'EXP-2026-00042',
      },
    });

    if (!existingShipment && supplier) {
      const shipment = await prisma.customsShipment.create({
        data: {
          company_id: company.id,
          shipment_number: 'EXP-2026-00042',
          supplier_id: supplier.id,
          customs_broker_id: broker?.id,
          incoterm: 'FOB',
          currency_code: 'USD',
          transport_mode: 'MARITIMO',
          origin_country_code: 'CN',
          destination_customs: '118',
          etd_date: new Date('2026-10-01T00:00:00Z'),
          eta_date: new Date('2026-10-22T00:00:00Z'),
          order_reference: 'OC-2026-0099',
          status: 'CON_LEVANTE',
        },
      });

      // Registrar eventos del expediente
      await prisma.customsEvent.createMany({
        data: [
          {
            shipment_id: shipment.id,
            event_type: 'ZARPE',
            event_timestamp: new Date('2026-10-01T10:00:00Z'),
            event_value: 'Nave zarpó de Puerto de Shanghai',
            registered_by: 'Operador Logístico Internacional',
          },
          {
            shipment_id: shipment.id,
            event_type: 'NUMERACION',
            event_timestamp: new Date('2026-10-18T14:30:00Z'),
            event_value: 'DAM 118-2026-10-458921 numerada en Despacho Anticipado',
            registered_by: 'Agencia de Aduana Callao',
          },
          {
            shipment_id: shipment.id,
            event_type: 'CANAL',
            event_timestamp: new Date('2026-10-18T14:35:00Z'),
            event_value: 'VERDE',
            registered_by: 'Sistema Integrado de Gestión Aduanera (SIGAD)',
          },
          {
            shipment_id: shipment.id,
            event_type: 'LEVANTE',
            event_timestamp: new Date('2026-10-22T09:00:00Z'),
            event_value: 'Levante Autorizado - Retiro de Terminal APM',
            registered_by: 'Especialista SUNAT Aduana Callao',
          },
        ],
      });

      console.log(
        `✓ Expediente Demo EXP-2026-00042 (100 Laptops) creado con bitácora de eventos.`,
      );
    }
  }

  console.log('--- Seeding de Módulo 3 Completado con Éxito ---');
}
