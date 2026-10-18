import { NotFoundException } from '@nestjs/common';
import { AddShipmentDocumentUseCase } from '../../../src/modules/customs/application/use-cases/addShipmentDocumentUseCase';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';

describe('AddShipmentDocumentUseCase', () => {
  let useCase: AddShipmentDocumentUseCase;
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

    useCase = new AddShipmentDocumentUseCase(mockShipmentRepo);
  });

  it('debe lanzar NotFoundException si el expediente no existe', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        'ship-unknown',
        {
          document_type: 'BL',
          document_number: 'MSCU123456',
          issue_date: new Date('2026-03-10'),
          storage_url: 'https://storage/doc.pdf',
        },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe adjuntar el documento y crear el evento con VUCE DR', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({ id: 'ship-1', company_id: 'comp-1' });
    mockShipmentRepo.addDocument.mockResolvedValue({ id: 'doc-1' });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-1' });

    const result = await useCase.execute(
      'ship-1',
      {
        document_type: 'PERMISO_DIGESA',
        document_number: 'DIG-2026-001',
        issue_date: new Date('2026-03-12'),
        issuer_name: 'DIGESA',
        storage_url: 'https://vuce.gob.pe/doc.pdf',
        vuce_dr_number: 'DR-998877',
      },
      'comp-1',
    );

    expect(result.id).toBe('doc-1');
    expect(mockShipmentRepo.addDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-1',
        documentType: 'PERMISO_DIGESA',
        documentNumber: 'DIG-2026-001',
        vuceDrNumber: 'DR-998877',
      }),
    );
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-1',
        eventType: 'DOCUMENTO_ADJUNTO',
        registeredBy: 'DIGESA',
        eventValue: expect.stringContaining('VUCE DR: DR-998877'),
      }),
    );
  });
});
