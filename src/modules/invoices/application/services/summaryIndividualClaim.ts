import { PrismaService } from '../../../../database/prismaService';
/** Coordina SOLO el canal individual de boletas con la reserva RC de M1. */
export async function claimIndividualSummaryChannel(db: PrismaService, id: string): Promise<boolean> {
  // Los dobles antiguos de Prisma no implementan el delegado de agregados.
  if (!db.invoiceAggregate) return true;
  const invoice = await db.invoice.findUnique({ where: { id }, select: { company_id: true, tipo_comprobante: true, serie: true } });
  if (!invoice || !['03', '07', '08'].includes(invoice.tipo_comprobante) || !invoice.serie.startsWith('B')) return true;
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.company_id}))`;
    const current = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { estado: true } });
    if (['ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'ANULADO'].includes(current.estado)) return true;
    const aggregates = await tx.invoiceAggregate.findMany({ where: { company_id: invoice.company_id, kind: 'RC', state: { notIn: ['BLOCKED', 'REJECTED'] } }, select: { members: true } });
    if (aggregates.some(a => (a.members as unknown as { id: string }[]).some(m => m.id === id))) return false;
    // Solo PENDIENTE compite con RC; conservar ERROR_RED/ENVIADO permite
    // que el reintento individual reconozca incertidumbre histórica (null).
    if (current.estado === 'PENDIENTE') await tx.invoice.update({ where: { id }, data: { estado: 'PROCESANDO' } });
    return true;
  });
}
