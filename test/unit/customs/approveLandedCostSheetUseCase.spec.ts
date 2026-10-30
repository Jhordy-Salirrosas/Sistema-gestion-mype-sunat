import { ApproveLandedCostSheetUseCase } from '../../../src/modules/customs/application/use-cases/approveLandedCostSheetUseCase';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ApproveLandedCostSheetUseCase (Application Use Case)', () => {
  let useCase: ApproveLandedCostSheetUseCase;
  let mockLandedCostRepo: any;
  let mockEventPublisher: any;

  beforeEach(() => {
    mockLandedCostRepo = {
      findLandedCostSheetByShipmentId: jest.fn(),
      saveLandedCostSheet: jest.fn().mockImplementation(async (data) => data),
    };
    mockEventPublisher = {
      publishCostApproved: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new ApproveLandedCostSheetUseCase(mockLandedCostRepo, mockEventPublisher);
  });

  it('debe aprobar hoja de costos y emitir evento a Inventario discriminando mercaderías y activos', async () => {
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({
      id: 'sheet-01',
      version: 1,
      total_cif_pen: 200000,
      total_duties_pen: 0,
      total_local_expenses_pen: 4000,
      total_inventory_cost_pen: 204000,
      approved_by_accountant: false,
      status: 'BORRADOR',
      shipment: {
        declarations: [
          {
            id: 'decl-01',
            items: [
              {
                product_code: 'LAP-01',
                commercial_description: 'Laptop Venta',
                quantity: 100,
                final_landed_cost_unit_pen: 2000,
                destination_type: 'MERCADERIA',
              },
              {
                product_code: 'SERV-01',
                commercial_description: 'Servidor Interno',
                quantity: 1,
                final_landed_cost_unit_pen: 4000,
                destination_type: 'ACTIVO_FIJO',
              },
            ],
          },
        ],
      },
    });

    const result = await useCase.execute({ shipmentId: 'ship-01' }, 'comp-1');

    expect(result.commercialItemsCount).toBe(1);
    expect(result.fixedAssetItemsCount).toBe(1);
    expect(mockLandedCostRepo.saveLandedCostSheet).toHaveBeenCalled();
    expect(mockEventPublisher.publishCostApproved).toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si no existe hoja para el expediente', async () => {
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue(null);

    await expect(
      useCase.execute({ shipmentId: 'ship-inexistente' }, 'comp-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar BadRequestException si la hoja ya fue aprobada formalmente', async () => {
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({
      id: 'sheet-01',
      approved_by_accountant: true,
      status: 'DEFINITIVO',
    });

    await expect(
      useCase.execute({ shipmentId: 'ship-01' }, 'comp-1'),
    ).rejects.toThrow(BadRequestException);
  });
});

