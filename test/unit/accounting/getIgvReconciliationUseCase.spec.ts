import { BadRequestException } from '@nestjs/common';
import { GetIgvReconciliationUseCase } from '../../../src/modules/accounting/application/use-cases/getIgvReconciliationUseCase';

describe('GetIgvReconciliationUseCase', () => {
  it('calcula IGV esperado y contable', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ total_igv: 180, taxable_operations: 1000 }]) },
      nationalPurchase: { findMany: jest.fn().mockResolvedValue([{ igv_amount: 90, net_amount: 500 }]) },
      expense: { findMany: jest.fn().mockResolvedValue([{ igv_amount: 18 }]) },
      accountingLine: { findMany: jest.fn().mockResolvedValue([{ debit_amount: 108, credit_amount: 180 }]) },
    };
    const r = await new GetIgvReconciliationUseCase(prisma as never).execute('c1', '2026-11');
    expect(r.expected).toBe(72);
    expect(r.accounting).toBe(72);
    expect(r.reconciled).toBe(true);
  });

  it('reporta diferencia y período inválido', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ total_igv: 180, taxable_operations: 1000 }]) },
      nationalPurchase: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      accountingLine: { findMany: jest.fn().mockResolvedValue([{ debit_amount: 0, credit_amount: 100 }]) },
    };
    const uc = new GetIgvReconciliationUseCase(prisma as never);
    await expect(uc.execute('c1', '2026-11')).resolves.toMatchObject({ difference: -80, reconciled: false });
    await expect(uc.execute('c1', '2026-13')).rejects.toBeInstanceOf(BadRequestException);
  });
});
