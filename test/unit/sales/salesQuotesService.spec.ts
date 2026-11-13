import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesQuotesService } from '../../../src/modules/sales/application/services/salesQuotesService';

const row = (over: Record<string, any> = {}) => ({
  id: 'q1', quote_number: 'COT-1', customer_doc_type: '6', customer_doc_number: '20100070970', customer_name: 'Cliente',
  issue_date: new Date('2026-11-14'), valid_until: null, currency_code: 'PEN', subtotal: 100, igv_amount: 18, total_amount: 118,
  status: 'BORRADOR', notes: null, items: [{ id: 'i1', sku: 'SKU1', description: 'Producto', unit_code: 'NIU', quantity: 1, unit_price: 118, subtotal: 100, igv_amount: 18, total_amount: 118 }], ...over,
});

function setup() {
  const prisma: any = {
    salesQuote: {
      findMany: jest.fn().mockResolvedValue([row()]),
      findFirst: jest.fn().mockResolvedValue(row()),
      create: jest.fn(async ({ data }: any) => row({ ...data, items: data.items.create.map((i: any, n: number) => ({ id: `i${n}`, ...i })) })),
      update: jest.fn(async ({ data }: any) => row({ ...data })),
    },
  };
  return { prisma, service: new SalesQuotesService(prisma) };
}

describe('SalesQuotesService', () => {
  it('lista y mapea cotizaciones', async () => {
    const { service } = setup();
    await expect(service.list('c1')).resolves.toEqual([expect.objectContaining({ quoteNumber: 'COT-1', customerName: 'Cliente', totalAmount: 118 })]);
  });

  it('obtiene una cotización y 404 si no existe', async () => {
    const { prisma, service } = setup();
    await expect(service.get('c1', 'q1')).resolves.toMatchObject({ id: 'q1' });
    prisma.salesQuote.findFirst.mockResolvedValueOnce(null);
    await expect(service.get('c1', 'no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea cotización con IGV y total', async () => {
    const { prisma, service } = setup();
    const q = await service.create('c1', { customerName: 'Cliente', items: [{ description: 'Producto', quantity: 2, unitPrice: 118 }] });
    expect(q.totalAmount).toBe(236);
    expect(prisma.salesQuote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: 200, igv_amount: 36, total_amount: 236 }) }));
  });

  it('rechaza cotización sin cliente o sin ítems', async () => {
    const { service } = setup();
    await expect(service.create('c1', { customerName: ' ', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('c1', { customerName: 'Cliente', items: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza estado y valida existencia', async () => {
    const { prisma, service } = setup();
    await expect(service.updateStatus('c1', 'q1', 'ACEPTADA')).resolves.toMatchObject({ status: 'ACEPTADA' });
    prisma.salesQuote.findFirst.mockResolvedValueOnce(null);
    await expect(service.updateStatus('c1', 'no', 'ACEPTADA')).rejects.toBeInstanceOf(NotFoundException);
  });
});
