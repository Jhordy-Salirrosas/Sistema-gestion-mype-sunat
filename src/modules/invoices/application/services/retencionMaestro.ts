import type { PrismaService } from '../../../../database/prismaService';

export async function resolverRetencionMaestro(
  prisma: PrismaService,
  datos: { companyId: string; tipo?: string; numero?: string; fecha: Date; enviado?: boolean; correccion?: boolean },
) {
  const partner = datos.tipo && datos.numero ? await prisma.businessPartner.findFirst({
    where: { company_id: datos.companyId, doc_type: datos.tipo, doc_number: datos.numero },
    select: { id: true },
  }) : null;
  const indicador = partner ? await prisma.partnerTaxStatus.findFirst({
    where: { partner_id: partner.id, indicator: 'RETENCION', valid_from: { lte: datos.fecha },
      OR: [{ valid_to: null }, { valid_to: { gte: datos.fecha } }] },
    orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
    select: { value: true },
  }) : null;
  const maestro = indicador?.value ?? null;
  const aplica = maestro === null || datos.correccion === true ? Boolean(datos.enviado) : maestro;
  const origen = maestro === null ? 'MANUAL_SIN_DATO' : datos.correccion === true && aplica !== maestro ? 'CORRECCION_MANUAL' : 'MAESTRO';
  const mensaje = origen === 'MANUAL_SIN_DATO'
    ? `Retención determinada manualmente por falta de dato vigente en el maestro: ${aplica ? 'sí' : 'no'}.`
    : origen === 'CORRECCION_MANUAL'
      ? `Retención por corrección manual: ${aplica ? 'sí' : 'no'}; maestro: ${maestro ? 'sí' : 'no'}.`
      : `Retención determinada por el maestro: ${aplica ? 'sí' : 'no'}${datos.enviado !== undefined && datos.enviado !== aplica ? '; difiere de la casilla enviada' : ''}.`;
  return { aplica, origen, maestro, mensaje };
}
