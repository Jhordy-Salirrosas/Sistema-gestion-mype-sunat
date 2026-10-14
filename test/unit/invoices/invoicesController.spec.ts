import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../../src/modules/invoices/infrastructure/controllers/invoicesController';
import { CreateInvoiceUseCase } from '../../../src/modules/invoices/application/use-cases/createInvoiceUseCase';

describe('InvoicesController', () => {
  let controller: InvoicesController;

  const mockUseCase = {
    execute: jest.fn(),
  };

  const dto = {
    ruc_emisor: '20100070970',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    monto_total: 100,
    fecha_emision: '2026-10-14T10:00:00.000Z',
    payload_ubl: {},
  };

  const invoiceResult = {
    id: 'inv-test-999',
    estado: 'PENDIENTE_ENVIO',
    created_at: new Date('2026-10-14T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUseCase.execute.mockResolvedValue(invoiceResult);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: CreateInvoiceUseCase,
          useValue: mockUseCase,
        },
      ],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  it('debe recibir el comprobante y delegar al caso de uso', async () => {
    const response = await controller.create(dto);

    expect(mockUseCase.execute).toHaveBeenCalledWith(dto);
    expect(response).toEqual({
      id: invoiceResult.id,
      estado: invoiceResult.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoiceResult.created_at,
    });
  });
});
