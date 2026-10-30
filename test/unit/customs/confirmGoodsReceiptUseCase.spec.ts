import { ConfirmGoodsReceiptUseCase } from '../../../src/modules/customs/application/use-cases/confirmGoodsReceiptUseCase';
import { NotFoundException } from '@nestjs/common';
import { GoodsReceiptEntity } from '../../../src/modules/customs/domain/entities/goodsReceiptEntity';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';

describe('ConfirmGoodsReceiptUseCase (Application Use Case)', () => {
  let useCase: ConfirmGoodsReceiptUseCase;
  let mockGoodsReceiptRepo: any;
  let mockEventPublisher: any;
  let mockCustomsRepo: any;

  beforeEach(() => {
    mockGoodsReceiptRepo = {
      save: jest.fn().mockImplementation(async (r: GoodsReceiptEntity) => r),
      findById: jest.fn(),
      findByReceiptNumber: jest.fn(),
      findByDeclarationId: jest.fn(),
      listByCompany: jest.fn(),
    };
    mockEventPublisher = {
      publishReceiptConfirmed: jest.fn().mockResolvedValue(undefined),
      publishCostApproved: jest.fn().mockResolvedValue(undefined),
    };
    mockCustomsRepo = {
      findDeclarationById: jest.fn(),
    };

    useCase = new ConfirmGoodsReceiptUseCase(
      mockGoodsReceiptRepo,
      mockEventPublisher,
      mockCustomsRepo,
    );
  });

  it('debe registrar acta de recepción conforme y emitir evento de dominio', async () => {
    mockCustomsRepo.findDeclarationById.mockResolvedValue(
      new CustomsDeclarationEntity({
        companyId: 'comp-1',
        duaNumber: '118-2026-10-001234',
        customsAgencyCode: '118',
        regimeCode: '10',
        numerationDate: new Date(),
        fobValueUsd: 1000,
        freightValueUsd: 100,
        insuranceValueUsd: 10,
        cifValueUsd: 1110,
        exchangeRate: 3.8,
        cifValuePen: 4218,
        adValoremRate: 0,
        adValoremAmountPen: 0,
        igvRate: 15.5,
        ipmRate: 2.5,
        igvIpmAmountPen: 759.24,
        perceptionRate: 3.5,
        perceptionAmountPen: 174.2,
        totalCustomsTaxesPen: 933.44,
        status: 'REGISTRADO',
      }),
    );

    const result = await useCase.execute(
      {
        receiptNumber: 'REC-2026-0001',
        declarationId: 'decl-01',
        responsibleName: 'Juan Almacenero',
        warehouseCode: 'ALM-CENTRAL',
        items: [
          {
            productCode: 'PROD-01',
            commercialDescription: 'Laptop Gamer 16',
            declaredQuantity: 10,
            receivedQuantity: 10,
            destinationType: 'MERCADERIA',
          },
        ],
      },
      'comp-1',
    );

    expect(result.status).toBe('CONFORME');
    expect(mockGoodsReceiptRepo.save).toHaveBeenCalled();
    expect(mockEventPublisher.publishReceiptConfirmed).toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si la DAM no existe para la empresa', async () => {
    mockCustomsRepo.findDeclarationById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          receiptNumber: 'REC-2026-0002',
          declarationId: 'decl-inexistente',
          responsibleName: 'Juan Almacenero',
          items: [],
        },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

