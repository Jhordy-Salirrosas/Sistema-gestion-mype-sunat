import { ListShipmentsUseCase } from '../../../src/modules/customs/application/use-cases/listShipmentsUseCase';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('ListShipmentsUseCase', () => {
  let useCase: ListShipmentsUseCase;
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

    useCase = new ListShipmentsUseCase(mockShipmentRepo);
  });

  it('debe listar expedientes con paginación por defecto', async () => {
    mockShipmentRepo.listShipments.mockResolvedValue({
      data: [{ id: 'ship-1' }],
      total: 1,
    });

    const result = await useCase.execute('comp-1');

    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(mockShipmentRepo.listShipments).toHaveBeenCalledWith({
      companyId: 'comp-1',
      status: undefined,
      search: undefined,
      page: 1,
      limit: 10,
    });
  });

  it('debe aplicar filtros válidos de estado y búsqueda textual', async () => {
    mockShipmentRepo.listShipments.mockResolvedValue({
      data: [{ id: 'ship-2' }, { id: 'ship-3' }],
      total: 15,
    });

    const result = await useCase.execute('comp-1', {
      status: ShipmentStatus.CON_LEVANTE,
      search: 'EXP-2026',
      page: 2,
      limit: 5,
    });

    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(3);
    expect(mockShipmentRepo.listShipments).toHaveBeenCalledWith({
      companyId: 'comp-1',
      status: ShipmentStatus.CON_LEVANTE,
      search: 'EXP-2026',
      page: 2,
      limit: 5,
    });
  });

  it('debe ignorar estados inválidos que no pertenezcan al enum', async () => {
    mockShipmentRepo.listShipments.mockResolvedValue({ data: [], total: 0 });

    await useCase.execute('comp-1', {
      status: 'ESTADO_INEXISTENTE',
    });

    expect(mockShipmentRepo.listShipments).toHaveBeenCalledWith(
      expect.objectContaining({
        status: undefined,
      }),
    );
  });
});
