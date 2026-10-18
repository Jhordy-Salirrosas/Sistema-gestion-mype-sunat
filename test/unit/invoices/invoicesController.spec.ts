import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../../src/modules/invoices/infrastructure/controllers/invoicesController';
import { CreateInvoiceUseCase } from '../../../src/modules/invoices/application/use-cases/createInvoiceUseCase';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('InvoicesController', () => {
  let controller: InvoicesController;

  const COMPANY_ID = 'company-test-001';

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
        // AuthGuard (aplicado con @UseGuards en el controlador) inyecta este
        // token. La prueba invoca el metodo directamente, sin pasar por el
        // guard, asi que basta con un stub.
        {
          provide: TOKEN_SERVICE_PORT,
          useValue: {
            signToken: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  it('debe recibir el comprobante y delegar al caso de uso', async () => {
    const response = await controller.create(dto, COMPANY_ID);

    // El tenant viaja como segundo argumento: se extrae del JWT, no del cuerpo.
    expect(mockUseCase.execute).toHaveBeenCalledWith(dto, COMPANY_ID);
    expect(response).toEqual({
      id: invoiceResult.id,
      estado: invoiceResult.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoiceResult.created_at,
    });
  });
});
