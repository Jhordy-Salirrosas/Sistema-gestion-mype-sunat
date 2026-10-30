import { GoodsReceiptController } from '../../../src/modules/customs/infrastructure/controllers/goodsReceiptController';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('GoodsReceiptController (Controller Unit Test)', () => {
  let controller: GoodsReceiptController;
  let mockUseCase: any;
  let mockRepo: any;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn().mockResolvedValue({ id: 'rec-01', status: 'CONFORME' }),
    };
    mockRepo = {
      findById: jest.fn(),
      listByCompany: jest.fn().mockResolvedValue([]),
    };
    controller = new GoodsReceiptController(mockUseCase, mockRepo);
  });

  it('debe registrar un acta y delegar al caso de uso', async () => {
    const dto: any = { receiptNumber: 'REC-001', declarationId: 'decl-01', items: [] };
    const result = await controller.confirmReceipt('comp-1', dto);

    expect(result).toBeDefined();
    expect(mockUseCase.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe arrojar UnauthorizedException si companyId no está presente', async () => {
    await expect(controller.confirmReceipt(undefined, {} as any)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.getReceiptById('rec-01', undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.listReceipts(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('debe arrojar NotFoundException si no encuentra el acta por ID', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(controller.getReceiptById('rec-inexistente', 'comp-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

