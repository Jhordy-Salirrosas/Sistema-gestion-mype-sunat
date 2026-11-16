import { PrismaSireAccountingPreviewRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireAccountingPreviewRepository';

describe('PrismaSireAccountingPreviewRepository', () => {
  function crearPrisma() {
    return {
      sireProposal: {
        findMany: jest.fn(),
      },
    };
  }

  it('agrupa los importes de las propuestas por libro', async () => {
    const prisma = crearPrisma();
    prisma.sireProposal.findMany.mockResolvedValue([
      {
        book_type: 'RVIE_VENTAS',
        taxable_base: 100,
        igv_amount: 18,
        total_amount: 118,
      },
      {
        book_type: 'RVIE_VENTAS',
        taxable_base: '50.50',
        igv_amount: '9.09',
        total_amount: '59.59',
      },
      {
        book_type: 'RCE_COMPRAS',
        taxable_base: 20,
        igv_amount: 3.6,
        total_amount: 23.6,
      },
    ]);
    const repository = new PrismaSireAccountingPreviewRepository(
      prisma as never,
    );

    const result = await repository.findPeriodTotals('company-1', '202602');

    expect(prisma.sireProposal.findMany).toHaveBeenCalledWith({
      where: {
        company_id: 'company-1',
        period: '202602',
        excluded_at: null,
      },
      select: {
        book_type: true,
        taxable_base: true,
        igv_amount: true,
        total_amount: true,
      },
    });
    expect(result).toEqual([
      {
        bookType: 'RVIE_VENTAS',
        taxableBase: 150.5,
        igvAmount: 27.09,
        totalAmount: 177.59,
        comprobantes: 2,
      },
      {
        bookType: 'RCE_COMPRAS',
        taxableBase: 20,
        igvAmount: 3.6,
        totalAmount: 23.6,
        comprobantes: 1,
      },
    ]);
  });

  it('devuelve un arreglo vacío cuando no hay propuestas', async () => {
    const prisma = crearPrisma();
    prisma.sireProposal.findMany.mockResolvedValue([]);
    const repository = new PrismaSireAccountingPreviewRepository(
      prisma as never,
    );

    await expect(
      repository.findPeriodTotals('company-1', '202601'),
    ).resolves.toEqual([]);
  });
});
