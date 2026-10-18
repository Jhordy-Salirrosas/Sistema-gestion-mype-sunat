import { PrismaCustomsShipmentRepository } from '../../../src/modules/customs/infrastructure/persistence/prismaCustomsShipmentRepository';
import type { PrismaService } from '../../../src/database/prismaService';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('PrismaCustomsShipmentRepository', () => {
  let repository: PrismaCustomsShipmentRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      customsShipment: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      customsDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customsEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    repository = new PrismaCustomsShipmentRepository(prismaMock as unknown as PrismaService);
  });

  it('debe crear un nuevo expediente con sus valores por defecto', async () => {
    prismaMock.customsShipment.create.mockResolvedValue({ id: 'ship-1' });

    const result = await repository.createShipment({
      companyId: 'comp-1',
      shipmentNumber: 'EXP-2026-0001',
    });

    expect(result.id).toBe('ship-1');
    expect(prismaMock.customsShipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: 'comp-1',
          shipment_number: 'EXP-2026-0001',
          incoterm: 'FOB',
          currency_code: 'USD',
          status: ShipmentStatus.BORRADOR,
        }),
      }),
    );
  });

  it('debe actualizar el estado del expediente', async () => {
    prismaMock.customsShipment.update.mockResolvedValue({ id: 'ship-1', status: ShipmentStatus.EN_TRANSITO });

    const result = await repository.updateShipmentStatus('ship-1', 'comp-1', ShipmentStatus.EN_TRANSITO);
    expect(result.status).toBe(ShipmentStatus.EN_TRANSITO);
    expect(prismaMock.customsShipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: { status: ShipmentStatus.EN_TRANSITO },
    });
  });

  it('debe buscar un expediente por ID y companyId con relaciones completas', async () => {
    prismaMock.customsShipment.findFirst.mockResolvedValue({ id: 'ship-1' });

    const result = await repository.findShipmentById('ship-1', 'comp-1');
    expect(result?.id).toBe('ship-1');
    expect(prismaMock.customsShipment.findFirst).toHaveBeenCalledWith({
      where: { id: 'ship-1', company_id: 'comp-1' },
      include: expect.objectContaining({
        supplier: true,
        customs_broker: true,
        documents: true,
        events: expect.any(Object),
        declarations: expect.any(Object),
        local_expenses: true,
        landed_cost_sheet: true,
      }),
    });
  });

  it('debe buscar un expediente por número de expediente y companyId', async () => {
    prismaMock.customsShipment.findFirst.mockResolvedValue({ id: 'ship-1', shipment_number: 'EXP-2026-0001' });

    const result = await repository.findShipmentByNumber('EXP-2026-0001', 'comp-1');
    expect(result?.shipment_number).toBe('EXP-2026-0001');
    expect(prismaMock.customsShipment.findFirst).toHaveBeenCalledWith({
      where: { company_id: 'comp-1', shipment_number: 'EXP-2026-0001' },
      include: expect.any(Object),
    });
  });

  it('debe listar expedientes aplicando filtros de estado, búsqueda textual y paginación', async () => {
    prismaMock.customsShipment.findMany.mockResolvedValue([{ id: 'ship-1' }]);
    prismaMock.customsShipment.count.mockResolvedValue(1);

    const result = await repository.listShipments({
      companyId: 'comp-1',
      status: ShipmentStatus.CON_LEVANTE,
      search: 'EXP-2026',
      page: 1,
      limit: 10,
    });

    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(prismaMock.customsShipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company_id: 'comp-1',
          status: ShipmentStatus.CON_LEVANTE,
          OR: expect.any(Array),
        }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('debe agregar un documento al expediente', async () => {
    prismaMock.customsDocument.create.mockResolvedValue({ id: 'doc-1' });

    const result = await repository.addDocument({
      shipmentId: 'ship-1',
      documentType: 'BL',
      documentNumber: 'BL-100',
      issueDate: new Date('2026-03-10'),
      storageUrl: 'https://storage/doc.pdf',
    });

    expect(result.id).toBe('doc-1');
    expect(prismaMock.customsDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shipment_id: 'ship-1',
        document_type: 'BL',
        document_number: 'BL-100',
        storage_url: 'https://storage/doc.pdf',
      }),
    });
  });

  it('debe agregar un evento al expediente', async () => {
    prismaMock.customsEvent.create.mockResolvedValue({ id: 'evt-1' });

    const result = await repository.addEvent({
      shipmentId: 'ship-1',
      eventType: 'ARRIBO',
      eventTimestamp: new Date('2026-03-15'),
      registeredBy: 'SISTEMA',
    });

    expect(result.id).toBe('evt-1');
    expect(prismaMock.customsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shipment_id: 'ship-1',
        event_type: 'ARRIBO',
        registered_by: 'SISTEMA',
      }),
    });
  });

  it('debe obtener la lista de eventos y documentos de un expediente ordenados', async () => {
    prismaMock.customsEvent.findMany.mockResolvedValue([{ id: 'evt-1' }]);
    prismaMock.customsDocument.findMany.mockResolvedValue([{ id: 'doc-1' }]);

    const events = await repository.getShipmentEvents('ship-1');
    const documents = await repository.getShipmentDocuments('ship-1');

    expect(events.length).toBe(1);
    expect(documents.length).toBe(1);
    expect(prismaMock.customsEvent.findMany).toHaveBeenCalledWith({
      where: { shipment_id: 'ship-1' },
      orderBy: { event_timestamp: 'desc' },
    });
    expect(prismaMock.customsDocument.findMany).toHaveBeenCalledWith({
      where: { shipment_id: 'ship-1' },
      orderBy: { issue_date: 'desc' },
    });
  });
});
