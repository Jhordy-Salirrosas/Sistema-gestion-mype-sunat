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

  // 2. Ingesta de Proveedores Internacionales Frecuentes
  const demoSuppliers = [
    {
      tax_id: 'CN91440300MA5XYZ12',
      business_name: 'Shenzhen Tech Global Ltd.',
      country_code: 'CN',
      default_currency: 'USD',
      is_related: false,
    },
    {
      tax_id: 'US942857193',
      business_name: 'Silicon Valley Components Inc.',
      country_code: 'US',
      default_currency: 'USD',
      is_related: false,
    },
    {
      tax_id: 'DE301948275',
      business_name: 'Hamburg Logistics & Spare Parts GmbH',
      country_code: 'DE',
      default_currency: 'USD',
      is_related: false,
    },
    {
      tax_id: 'TW53892014',
      business_name: 'Taipei Semiconductor Group Co.',
      country_code: 'TW',
      default_currency: 'USD',
      is_related: false,
    },
  ];

  await prisma.foreignSupplier.createMany({
    data: demoSuppliers,
    skipDuplicates: true,
  });
  console.log(`✓ Proveedores internacionales registrados en foreign_suppliers.`);

  // 3. Crear Expediente Demo (Caso Juan: 100 Laptops Gamer)
  const company = await prisma.company.findFirst({
    where: { ruc: '20601234567' },
  });

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
