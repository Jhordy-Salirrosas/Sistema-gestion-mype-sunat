import { ConflictException } from '@nestjs/common';
import { CreateShipmentUseCase } from '../../../src/modules/customs/application/use-cases/createShipmentUseCase';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('CreateShipmentUseCase', () => {
  let useCase: CreateShipmentUseCase;
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
    useCase = new CreateShipmentUseCase(mockShipmentRepo);
  });

  it('debe crear un nuevo expediente exitosamente y registrar el evento inicial', async () => {
    mockShipmentRepo.findShipmentByNumber.mockResolvedValue(null);
    mockShipmentRepo.createShipment.mockResolvedValue({
      id: 'ship-123',
      company_id: 'comp-1',
      shipment_number: 'EXP-2026-0001',
      incoterm: 'FOB',
      origin_country_code: 'CN',
      status: ShipmentStatus.BORRADOR,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-1' });

    const result = await useCase.execute(
      {
        shipment_number: 'EXP-2026-0001',
        incoterm: 'FOB',
        currency_code: 'USD',
        transport_mode: 'MARITIMO',
        origin_country_code: 'CN',
      },
      'comp-1',
    );

    expect(result.id).toBe('ship-123');
    expect(mockShipmentRepo.createShipment).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-123',
        eventType: 'CREACION_EXPEDIENTE',
      }),
    );
  });

  it('debe arrojar ConflictException si el número de expediente ya existe', async () => {
    mockShipmentRepo.findShipmentByNumber.mockResolvedValue({
      id: 'existing-id',
      shipment_number: 'EXP-2026-0001',
    });

    await expect(
      useCase.execute({ shipment_number: 'EXP-2026-0001' }, 'comp-1'),
    ).rejects.toThrow(ConflictException);

    expect(mockShipmentRepo.createShipment).not.toHaveBeenCalled();
  });
});
