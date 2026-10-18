import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { ReconciliationHistoryRecord } from '../../domain/ports/sireRepositoryPort';
import { mapHistoryRecord } from './sirePrismaMappers';

type BookType = 'RVIE' | 'RCE';

function prismaBookType(bookType: BookType) {
  return bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS';
}

export async function findSireReconciliationForExport(
  prisma: PrismaService,
  companyId: string,
  period: string,
  bookType: BookType,
): Promise<ReconciliationHistoryRecord | null> {
  const result = await prisma.sireReconciliation.findFirst({
    where: {
      company_id: companyId,
      period,
      book_type: prismaBookType(bookType),
    },
    orderBy: { created_at: 'desc' },
    include: { discrepancies: true },
  });
  return result ? mapHistoryRecord(result) : null;
}

export async function getSireClosedHistory(
  prisma: PrismaService,
  companyId: string,
  skip: number,
  take: number,
) {
  const where = { company_id: companyId, status: 'CERRADO' as const };
  const [total, records] = await prisma.$transaction([
    prisma.sireReconciliation.count({ where }),
    prisma.sireReconciliation.findMany({
      where,
      skip,
      take,
      orderBy: [{ period: 'desc' }, { created_at: 'desc' }],
      include: { discrepancies: true },
    }),
  ]);
  return { total, items: records.map(mapHistoryRecord) };
}

export async function closeSireFiscalPeriod(
  prisma: PrismaService,
  companyId: string,
  period: string,
  bookType: BookType,
): Promise<void> {
  const dbBookType = prismaBookType(bookType);
  const result = await prisma.sireReconciliation.updateMany({
    where: {
      company_id: companyId,
      period,
      book_type: dbBookType,
      status: { not: 'CERRADO' },
    },
    data: { status: 'CERRADO', reconciled_at: new Date() },
  });
  if (result.count) return;
  const existing = await prisma.sireReconciliation.findFirst({
    where: { company_id: companyId, period, book_type: dbBookType },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundException('No existe conciliación para cerrar.');
  throw new ConflictException('El periodo ya está cerrado.');
}
