/**
 * Carga el padrón de agentes de retención del IGV desde un CSV.
 *
 * Formato: ruc,razon_social,valid_from
 * Ejemplo: 20123456789,EMPRESA EJEMPLO S.A.C.,2026-01-01
 *
 * No se ejecuta automáticamente. Requiere la tabla partner_tax_status.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '../src/generated/client/client';
import { parsearPadron } from '../src/modules/invoices/application/services/retentionPadronParser';

const prisma = new PrismaClient();

async function tablaDisponible(): Promise<boolean> {
  const [row] = await prisma.$queryRaw<Array<{ existe: string | null }>>`
    SELECT to_regclass('public.partner_tax_status')::text AS existe
  `;
  return Boolean(row?.existe);
}

async function main(): Promise<void> {
  const archivo = process.argv[2] ?? 'scripts/data/agentes-retencion.csv';
  const companyId = process.argv[3];

  if (!(await tablaDisponible())) {
    throw new Error(
      'Falta la tabla partner_tax_status. Aplicar la migración de D4 antes de ejecutar este script.',
    );
  }

  const filas = parsearPadron(readFileSync(archivo, 'utf8'));
  const empresas = companyId
    ? await prisma.company.findMany({ where: { id: companyId }, select: { id: true } })
    : await prisma.company.findMany({ select: { id: true } });

  if (empresas.length === 0) throw new Error('No hay empresas para cargar el padrón.');

  let creados = 0;
  let actualizados = 0;

  for (const empresa of empresas) {
    for (const fila of filas) {
      const partner = await prisma.businessPartner.upsert({
        where: {
          company_id_doc_type_doc_number: {
            company_id: empresa.id,
            doc_type: '6',
            doc_number: fila.ruc,
          },
        },
        update: { legal_name: fila.razonSocial, is_active: true },
        create: {
          company_id: empresa.id,
          doc_type: '6',
          doc_number: fila.ruc,
          legal_name: fila.razonSocial,
          roles: ['CLIENTE'],
          is_active: true,
        },
        select: { id: true },
      });

      const vigente = await prisma.partnerTaxStatus.findFirst({
        where: {
          partner_id: partner.id,
          indicator: 'RETENCION',
          value: true,
          valid_from: fila.validFrom,
        },
        select: { id: true },
      });
      if (vigente) continue;

      await prisma.$transaction([
        prisma.partnerTaxStatus.updateMany({
          where: { partner_id: partner.id, indicator: 'RETENCION', valid_to: null },
          data: { valid_to: fila.validFrom },
        }),
        prisma.partnerTaxStatus.create({
          data: {
            partner_id: partner.id,
            indicator: 'RETENCION',
            value: true,
            valid_from: fila.validFrom,
            source: 'SUNAT',
            updated_by: 'PADRON_SUNAT',
          },
        }),
      ]);
      creados += 1;
    }
  }

  console.log(`Padrón procesado: ${filas.length} filas, ${creados} indicadores creados.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
