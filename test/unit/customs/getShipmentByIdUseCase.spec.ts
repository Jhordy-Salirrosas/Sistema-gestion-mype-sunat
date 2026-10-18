import { NotFoundException } from '@nestjs/common';
import { GetShipmentByIdUseCase } from '../../../src/modules/customs/application/use-cases/getShipmentByIdUseCase';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';

describe('GetShipmentByIdUseCase', () => {
  let useCase: GetShipmentByIdUseCase;
  let mockShipmentRepo: jest.Mocked<ICustomsShipmentRepositoryPort>;

  beforeEach(() => {
    mockShipmentRepo = {
      createShipment: jest.fn(),
      updateShipmentStatus: jest.fn(),
      findShipmentById: jest.fn(),
      findShipmentByNumber: jest.fn(),
      listShipments: jest.fn(),
      addDocument: jest.fn(),
      addEvent: jest.fn(),
      getShipmentEvents: jest.fn(),
      getShipmentDocuments: jest.fn(),
    };

    useCase = new GetShipmentByIdUseCase(mockShipmentRepo);
  });

  it('debe retornar el expediente si existe para la empresa', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-123',
      company_id: 'comp-1',
      shipment_number: 'EXP-2026-0001',
    });

    const result = await useCase.execute('ship-123', 'comp-1');
    expect(result.id).toBe('ship-123');
    expect(mockShipmentRepo.findShipmentById).toHaveBeenCalledWith('ship-123', 'comp-1');
  });

  it('debe lanzar NotFoundException si no existe o pertenece a otra empresa', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue(null);

    await expect(useCase.execute('ship-999', 'comp-1')).rejects.toThrow(NotFoundException);
  });
});
