import { BadRequestException } from '@nestjs/common';
import { SalesQuotesService } from '../../../src/modules/sales/application/services/salesQuotesService';

function service() {
  const prisma: any = { salesQuote: { create: jest.fn(async ({ data }: any) => ({ id: 'q1', ...data, items: data.items.create })) } };
  return { prisma, sut: new SalesQuotesService(prisma) };
}
const base = { customerName: 'Cliente', items: [{ description: 'Producto', quantity: 1, unitPrice: 118 }] };

describe('SalesQuotesService - documento', () => {
  it('acepta RUC válido y guarda tipo 6', async () => {
    const { prisma, sut } = service();
    await expect(sut.create('c1', { ...base, customerDocType: '6', customerDocNumber: '20100070970' })).resolves.toMatchObject({ customerDocType: '6' });
    expect(prisma.salesQuote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customer_doc_type: '6', customer_doc_number: '20100070970' }) }));
  });

  it('rechaza RUC/DNI inválidos y acepta sin documento', async () => {
    const { sut } = service();
    await expect(sut.create('c1', { ...base, customerDocType: '6', customerDocNumber: '123' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(sut.create('c1', { ...base, customerDocType: '1', customerDocNumber: '123' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(sut.create('c1', { ...base, customerDocType: '1', customerDocNumber: '12345678' })).resolves.toMatchObject({ customerDocType: '1' });
    await expect(sut.create('c1', { ...base, customerDocType: '0' })).resolves.toMatchObject({ customerDocType: '0', customerDocNumber: null });
  });
});
