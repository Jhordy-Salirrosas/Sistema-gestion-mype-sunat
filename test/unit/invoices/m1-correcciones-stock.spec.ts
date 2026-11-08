import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';

describe('M1 afectación del producto durante emisión', () => {
  function montar(afectacion: string | null) {
    const prisma = {
      inventoryProduct: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'p1',
              sku: 'EXO',
              description: 'Producto exonerado',
              sunat_unit_code: 'NIU',
              tax_affectation: afectacion,
            },
          ]),
      },
      inventoryBalance: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { product_id: 'p1', _sum: { current_stock: 10 } },
          ]),
      },
    };
    return { prisma, service: new StockValidationService(prisma as never) };
  }
  it.each(['10', '30', '21'])(
    'rechaza alterar afectación 20 a %s aun con stock suficiente',
    async (afectacion) => {
      const { service } = montar('20');
      await expect(
        service.validar('empresa', [
          { codigo: 'EXO', descripcion: 'Producto', cantidad: 1, afectacion },
        ]),
      ).rejects.toThrow(/afectación tributaria del producto EXO \(20\)/);
    },
  );
  it('acepta la afectación del maestro normalizada y consulta solo productos de la empresa', async () => {
    const { service, prisma } = montar(' 20 ');
    expect(
      await service.validar('empresa', [
        {
          codigo: ' EXO ',
          descripcion: 'Producto',
          cantidad: 1,
          afectacion: ' 20 ',
        },
      ]),
    ).toEqual({ validados: 1, omitidos: 0, avisos: [] });
    expect(prisma.inventoryProduct.findMany).toHaveBeenCalledWith({
      where: { company_id: 'empresa', sku: { in: ['EXO'] }, is_active: true },
      select: {
        id: true,
        sku: true,
        description: true,
        sunat_unit_code: true,
        tax_affectation: true,
        is_inventory: true,
      },
    });
    expect(
      prisma.inventoryBalance.groupBy.mock.calls[0][0].where.company_id,
    ).toBe('empresa');
  });
});
