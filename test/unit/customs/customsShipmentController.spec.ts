import { CustomsShipmentController } from '../../../src/modules/customs/infrastructure/controllers/customsShipmentController';
import { CreateShipmentUseCase } from '../../../src/modules/customs/application/use-cases/createShipmentUseCase';
import { ListShipmentsUseCase } from '../../../src/modules/customs/application/use-cases/listShipmentsUseCase';
import { GetShipmentByIdUseCase } from '../../../src/modules/customs/application/use-cases/getShipmentByIdUseCase';
import { AddShipmentDocumentUseCase } from '../../../src/modules/customs/application/use-cases/addShipmentDocumentUseCase';
import { AddShipmentEventUseCase } from '../../../src/modules/customs/application/use-cases/addShipmentEventUseCase';
import { CreateShipmentDto } from '../../../src/modules/customs/application/dto/createShipmentDto';
import { AddDocumentDto } from '../../../src/modules/customs/application/dto/addDocumentDto';
import { AddEventDto } from '../../../src/modules/customs/application/dto/addEventDto';

describe('CustomsShipmentController', () => {
  let controller: CustomsShipmentController;
  let mockCreateShipment: jest.Mocked<CreateShipmentUseCase>;
  let mockListShipments: jest.Mocked<ListShipmentsUseCase>;
  let mockGetShipmentById: jest.Mocked<GetShipmentByIdUseCase>;
  let mockAddDocument: jest.Mocked<AddShipmentDocumentUseCase>;
  let mockAddEvent: jest.Mocked<AddShipmentEventUseCase>;

  beforeEach(() => {
    mockCreateShipment = { execute: jest.fn() } as any;
    mockListShipments = { execute: jest.fn() } as any;
    mockGetShipmentById = { execute: jest.fn() } as any;
    mockAddDocument = { execute: jest.fn() } as any;
    mockAddEvent = { execute: jest.fn() } as any;

    controller = new CustomsShipmentController(
      mockCreateShipment,
      mockListShipments,
      mockGetShipmentById,
      mockAddDocument,
      mockAddEvent,
    );
  });

  it('debe llamar a createShipmentUseCase con el DTO y companyId', async () => {
    const dto: CreateShipmentDto = {
      shipment_number: 'EXP-2026-0001',
      incoterm: 'FOB',
    };
    mockCreateShipment.execute.mockResolvedValue({ id: 'ship-1', shipment_number: 'EXP-2026-0001' });

    const result = await controller.createShipment('comp-1', dto);

    expect(result).toEqual({ id: 'ship-1', shipment_number: 'EXP-2026-0001' });
    expect(mockCreateShipment.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe listar expedientes llamando a listShipmentsUseCase con filtros y paginación', async () => {
    mockListShipments.execute.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });

    const result = await controller.listShipments('comp-1', 'EN_TRANSITO', 'EXP', '1', '10');

    expect(result.data).toEqual([]);
    expect(mockListShipments.execute).toHaveBeenCalledWith('comp-1', {
      status: 'EN_TRANSITO',
      search: 'EXP',
      page: 1,
      limit: 10,
    });
  });

  it('debe obtener detalle de expediente por id', async () => {
    mockGetShipmentById.execute.mockResolvedValue({ id: 'ship-1', shipment_number: 'EXP-2026-0001' });

    const result = await controller.getShipmentById('ship-1', 'comp-1');

    expect(result.id).toBe('ship-1');
    expect(mockGetShipmentById.execute).toHaveBeenCalledWith('ship-1', 'comp-1');
  });

  it('debe adjuntar documento a expediente', async () => {
    const dto: AddDocumentDto = {
      document_type: 'FAC',
      document_number: 'INV-1001',
      issue_date: new Date(),
      storage_url: 'https://supabase.co/file.pdf',
    };
    mockAddDocument.execute.mockResolvedValue({ id: 'doc-1', document_number: 'INV-1001' });

    const result = await controller.addDocument('ship-1', 'comp-1', dto);

    expect(result.id).toBe('doc-1');
    expect(mockAddDocument.execute).toHaveBeenCalledWith('ship-1', dto, 'comp-1');
  });

  it('debe registrar un evento aduanero en el expediente', async () => {
    const dto: AddEventDto = {
      event_type: 'ARRIBO',
      event_timestamp: new Date(),
      registered_by: 'AGENTE_ADUANAS',
    };
    mockAddEvent.execute.mockResolvedValue({ id: 'evt-1', event_type: 'ARRIBO' });

    const result = await controller.addEvent('ship-1', 'comp-1', dto);

    expect(result.id).toBe('evt-1');
    expect(mockAddEvent.execute).toHaveBeenCalledWith('ship-1', dto, 'comp-1');
  });
});
