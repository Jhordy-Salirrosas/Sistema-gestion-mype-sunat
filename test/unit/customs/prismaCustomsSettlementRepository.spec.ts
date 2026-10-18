import { PrismaCustomsSettlementRepository } from '../../../src/modules/customs/infrastructure/persistence/prismaCustomsSettlementRepository';
import type { PrismaService } from '../../../src/database/prismaService';
import { SettlementStatus } from '../../../src/modules/customs/domain/enums/settlementStatus.enum';
import { SettlementType } from '../../../src/modules/customs/domain/enums/settlementType.enum';

describe('PrismaCustomsSettlementRepository', () => {
  let repository: PrismaCustomsSettlementRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      customsSettlement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    repository = new PrismaCustomsSettlementRepository(prismaMock as unknown as PrismaService);
  });

  it('debe crear múltiples liquidaciones en la base de datos', async () => {
    prismaMock.customsSettlement.create.mockResolvedValueOnce({
      id: 'settle-1',
      settlement_number: '001',
    });

    const result = await repository.createSettlements([
      {
        declarationId: 'decl-1',
        settlementType: SettlementType.TIPO_0026_MAYOR_VALOR,
        settlementNumber: '001',
        taxCode: 'TRIB-01',
        amountUsd: 100,
        amountPen: 380,
        cdaNumber: '11826100104589',
        dueDate: new Date(),
      },
    ]);

    expect(result.length).toBe(1);
    expect(prismaMock.customsSettlement.create).toHaveBeenCalledTimes(1);
  });

  it('debe buscar liquidación por id con declaración y expediente incluidos', async () => {
    prismaMock.customsSettlement.findUnique.mockResolvedValue({
      id: 'settle-1',
      declaration: { shipment: { id: 'ship-1' } },
    });

    const result = await repository.findSettlementById('settle-1');
    expect(result?.id).toBe('settle-1');
    expect(prismaMock.customsSettlement.findUnique).toHaveBeenCalledWith({
      where: { id: 'settle-1' },
      include: { declaration: { include: { shipment: true } } },
    });
  });

  it('debe buscar liquidaciones por ID de declaración ordenadas por due_date', async () => {
    prismaMock.customsSettlement.findMany.mockResolvedValue([{ id: 'settle-1' }]);

    const result = await repository.findSettlementsByDeclarationId('decl-1');
    expect(result.length).toBe(1);
    expect(prismaMock.customsSettlement.findMany).toHaveBeenCalledWith({
      where: { declaration_id: 'decl-1' },
      orderBy: { due_date: 'asc' },
    });
  });

  it('debe buscar liquidaciones pendientes por empresa', async () => {
    prismaMock.customsSettlement.findMany.mockResolvedValue([{ id: 'settle-1' }]);

    const result = await repository.findPendingSettlementsByCompany('comp-1');
    expect(result.length).toBe(1);
    expect(prismaMock.customsSettlement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          declaration: { company_id: 'comp-1' },
          status: SettlementStatus.GENERADA,
        },
      }),
    );
  });

  it('debe actualizar el estado a PAGADA y asentar datos bancarios', async () => {
    const paidAt = new Date('2026-03-25T10:00:00Z');
    prismaMock.customsSettlement.update.mockResolvedValue({
      id: 'settle-1',
      status: SettlementStatus.PAGADA,
      bank_code: 'BCP',
    });

    const result = await repository.registerSettlementPayment({
      settlementId: 'settle-1',
      bankCode: 'BCP',
      bankOperationNumber: 'OP-1234',
      paidAt,
      voucherStorageUrl: 'https://vouchers.storage/v1.pdf',
    });

    expect(result.status).toBe(SettlementStatus.PAGADA);
    expect(prismaMock.customsSettlement.update).toHaveBeenCalledWith({
      where: { id: 'settle-1' },
      data: {
        status: SettlementStatus.PAGADA,
        bank_code: 'BCP',
        bank_operation_number: 'OP-1234',
        paid_at: paidAt,
        voucher_storage_url: 'https://vouchers.storage/v1.pdf',
      },
    });
  });
});
