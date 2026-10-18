import { NotFoundException } from '@nestjs/common';
import { AddShipmentEventUseCase } from '../../../src/modules/customs/application/use-cases/addShipmentEventUseCase';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('AddShipmentEventUseCase', () => {
  let useCase: AddShipmentEventUseCase;
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

    useCase = new AddShipmentEventUseCase(mockShipmentRepo);
  });

  it('debe lanzar NotFoundException si el expediente no existe', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        'ship-unknown',
        {
          event_type: 'ARRIBO',
          event_timestamp: new Date('2026-03-15T08:00:00Z'),
          registered_by: 'USUARIO',
        },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe actualizar estado a EN_TRANSITO cuando el evento es ZARPE y el estado era BORRADOR', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-1',
      company_id: 'comp-1',
      status: ShipmentStatus.BORRADOR,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-1' });

    await useCase.execute(
      'ship-1',
      {
        event_type: 'ZARPE',
        event_timestamp: new Date('2026-03-10T10:00:00Z'),
        registered_by: 'AGENTE_CARGA',
      },
      'comp-1',
    );

    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-1',
      'comp-1',
      ShipmentStatus.EN_TRANSITO,
    );
  });

  it('debe actualizar estado a ARRIBADO cuando el evento es ARRIBO', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-1',
      company_id: 'comp-1',
      status: ShipmentStatus.EN_TRANSITO,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-2' });

    await useCase.execute(
      'ship-1',
      {
        event_type: 'ARRIBO',
        event_timestamp: new Date('2026-03-15T10:00:00Z'),
        registered_by: 'TERMINAL_PORTUARIO',
      },
      'comp-1',
    );

    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-1',
      'comp-1',
      ShipmentStatus.ARRIBADO,
    );
  });

  it('debe actualizar estado a EN_DESPACHO cuando el evento es NUMERACION', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-1',
      company_id: 'comp-1',
      status: ShipmentStatus.ARRIBADO,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-3' });

    await useCase.execute(
      'ship-1',
      {
        event_type: 'NUMERACION',
        event_timestamp: new Date('2026-03-16T10:00:00Z'),
        registered_by: 'AGENCIA_ADUANA',
      },
      'comp-1',
    );

    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-1',
      'comp-1',
      ShipmentStatus.EN_DESPACHO,
    );
  });

  it('debe actualizar estado a CON_LEVANTE cuando el evento es LEVANTE', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-1',
      company_id: 'comp-1',
      status: ShipmentStatus.EN_DESPACHO,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-4' });

    await useCase.execute(
      'ship-1',
      {
        event_type: 'LEVANTE',
        event_timestamp: new Date('2026-03-18T10:00:00Z'),
        registered_by: 'SUNAT',
      },
      'comp-1',
    );

    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-1',
      'comp-1',
      ShipmentStatus.CON_LEVANTE,
    );
  });
});
