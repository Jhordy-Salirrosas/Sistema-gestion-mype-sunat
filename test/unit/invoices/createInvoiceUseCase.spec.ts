import { Test, TestingModule } from '@nestjs/testing';
import { CreateInvoiceUseCase } from '../../../src/modules/invoices/application/use-cases/createInvoiceUseCase';
import {
  IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
} from '../../../src/modules/invoices/domain/ports/invoiceRepositoryPort';

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;

  const mockRepo: IInvoiceRepositoryPort = {
    saveWithTransactionalOutbox: jest.fn(),
  };

  const dto = {
    ruc_emisor: '20100070970',
    serie: 'F001',
    correlativo: 10,
    tipo_comprobante: '01',
    monto_total: 236.0,
    fecha_emision: '2026-10-14T10:00:00.000Z',
    payload_ubl: { items: [] },
  };

  const expectedResult = {
    id: 'inv-12345',
    estado: 'PENDIENTE_ENVIO',
    created_at: new Date('2026-10-14T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockRepo.saveWithTransactionalOutbox as jest.Mock).mockResolvedValue(
      expectedResult,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInvoiceUseCase,
        {
          provide: INVOICE_REPOSITORY_PORT,
          useValue: mockRepo,
        },
      ],
    }).compile();

    useCase = module.get<CreateInvoiceUseCase>(CreateInvoiceUseCase);
  });

  it('mapea el DTO a la entidad de dominio y delega la persistencia al puerto', async () => {
    const result = await useCase.execute(dto, 'company-test-001');

    expect(mockRepo.saveWithTransactionalOutbox).toHaveBeenCalledTimes(1);
    const calledEntity = (mockRepo.saveWithTransactionalOutbox as jest.Mock)
      .mock.calls[0][0];

    expect(calledEntity.ruc_emisor).toBe(dto.ruc_emisor);
    expect(calledEntity.serie).toBe(dto.serie);
    expect(calledEntity.correlativo).toBe(dto.correlativo);
    expect(calledEntity.monto_total).toBe(dto.monto_total);
    expect(calledEntity.estado).toBe('PENDIENTE_ENVIO');
    expect(result).toEqual(expectedResult);
  });
});
