import type { Prisma } from '../generated/client/client';
/** Exclusión común de clasificación, sin dependencia entre módulos de negocio. */
export async function bloquearClasificacionProductos(tx: Pick<Prisma.TransactionClient, '$executeRaw'>, companyId: string, skus: readonly string[]): Promise<void> {
  for (const sku of [...new Set(skus.map(s => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'m1:product-classification:' + companyId + ':' + sku}, 0))`;
  }
}
