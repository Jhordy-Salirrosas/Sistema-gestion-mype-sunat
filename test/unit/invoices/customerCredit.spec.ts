import { InvoiceCustomerService } from '../../../src/modules/invoices/application/services/invoiceCustomerService';

function setup() {
  const prisma: any = {
    businessPartner: { findFirst: jest.fn().mockResolvedValue({ has_credit: true, credit_limit: 1000 }) },
    invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'f1', monto_total: 600 }]), aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 50 } }) },
    collection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }) },
  };
  return { prisma, service: new InvoiceCustomerService(prisma) };
}

describe('InvoiceCustomerService - cupo', () => {
  it('calcula usado y disponible', async () => {
    const { service } = setup();
    await expect(service.credito('c1', '6', '20100070970')).resolves.toEqual({ hasCredit: true, creditLimit: 1000, used: 450, available: 550 });
  });

  it('devuelve sin crédito si el cliente no existe', async () => {
    const { prisma, service } = setup();
    prisma.businessPartner.findFirst.mockResolvedValueOnce(null);
    await expect(service.credito('c1', '6', '20100070970')).resolves.toEqual({ hasCredit: false, creditLimit: null, used: 0, available: null });
  });

  it('deja el disponible en null si no hay límite', async () => {
    const { prisma, service } = setup();
    prisma.businessPartner.findFirst.mockResolvedValueOnce({ has_credit: true, credit_limit: null });
    await expect(service.credito('c1', '6', '20100070970')).resolves.toMatchObject({ creditLimit: null, available: null });
  });
});
