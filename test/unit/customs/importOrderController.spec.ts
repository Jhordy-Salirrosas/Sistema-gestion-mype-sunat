import { UnauthorizedException } from '@nestjs/common';
import { ImportOrderController } from '../../../src/modules/customs/infrastructure/controllers/importOrderController';

describe('ImportOrderController', () => {
  let controller: ImportOrderController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      createOrder: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      listOrders: jest.fn().mockResolvedValue({ total: 1, items: [] }),
      getOrderById: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      advanceStage: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      addDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      listDocuments: jest.fn().mockResolvedValue([]),
      getChecklist: jest.fn().mockResolvedValue({ stages: [] }),
      generateShipment: jest.fn().mockResolvedValue({ id: 'ship-1' }),
    };

    controller = new ImportOrderController(mockService);
  });

  it('lanza UnauthorizedException si companyId no está definido', async () => {
    await expect(controller.createOrder(undefined, {} as any)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listOrders(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getOrderById('1', undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.advanceStage('1', undefined, {} as any)).rejects.toThrow(UnauthorizedException);
    await expect(controller.addDocument('1', undefined, {} as any)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listDocuments('1', undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getChecklist('1', undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.generateShipment('1', undefined, {} as any)).rejects.toThrow(UnauthorizedException);
  });

  it('delega correctamente en ImportOrderService cuando se provee companyId', async () => {
    const comp = 'comp-1';

    await controller.createOrder(comp, {} as any);
    await controller.listOrders(comp, 'APROBADA', 'tech');
    await controller.getOrderById('1', comp);
    await controller.advanceStage('1', comp, {} as any);
    await controller.addDocument('1', comp, {} as any);
    await controller.listDocuments('1', comp);
    await controller.getChecklist('1', comp);
    await controller.generateShipment('1', comp, {} as any);

    expect(mockService.createOrder).toHaveBeenCalledWith(comp, {});
    expect(mockService.listOrders).toHaveBeenCalledWith(comp, { status: 'APROBADA', search: 'tech' });
    expect(mockService.getOrderById).toHaveBeenCalledWith(comp, '1');
    expect(mockService.advanceStage).toHaveBeenCalledWith(comp, '1', {});
    expect(mockService.addDocument).toHaveBeenCalledWith(comp, '1', {});
    expect(mockService.listDocuments).toHaveBeenCalledWith(comp, '1');
    expect(mockService.getChecklist).toHaveBeenCalledWith(comp, '1');
    expect(mockService.generateShipment).toHaveBeenCalledWith(comp, '1', {});
  });
});

