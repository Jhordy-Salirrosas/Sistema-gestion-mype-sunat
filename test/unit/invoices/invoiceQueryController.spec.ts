import { BadRequestException } from '@nestjs/common';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';

function controller(clientes: any) {
  return new InvoiceQueryController({} as any, {} as any, {} as any, {} as any, clientes, {} as any, {} as any, {} as any, {} as any, {} as any);
}

describe('InvoiceQueryController - cupo', () => {
  it('delega la consulta de cupo', async () => {
    const clientes = { credito: jest.fn().mockResolvedValue({ hasCredit: true }) };
    const c = controller(clientes);
    await expect(c.customerCredit('c1', '6', '20100070970')).resolves.toMatchObject({ hasCredit: true });
    expect(clientes.credito).toHaveBeenCalledWith('c1', '6', '20100070970');
  });

  it('exige documento', async () => {
    await expect(controller({}).customerCredit('c1', '', '')).rejects.toBeInstanceOf(BadRequestException);
  });
});
