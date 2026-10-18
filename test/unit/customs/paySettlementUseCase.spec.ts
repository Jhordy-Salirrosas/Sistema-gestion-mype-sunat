import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaySettlementUseCase } from '../../../src/modules/customs/application/use-cases/paySettlementUseCase';
import type { ICustomsSettlementRepositoryPort } from '../../../src/modules/customs/domain/ports/customsSettlementRepositoryPort';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import { SettlementStatus } from '../../../src/modules/customs/domain/enums/settlementStatus.enum';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('PaySettlementUseCase', () => {
  let useCase: PaySettlementUseCase;
  let mockSettlementRepo: jest.Mocked<ICustomsSettlementRepositoryPort>;
  let mockShipmentRepo: jest.Mocked<ICustomsShipmentRepositoryPort>;

  beforeEach(() => {
    mockSettlementRepo = {
      createSettlements: jest.fn(),
      findSettlementById: jest.fn(),
      findSettlementsByDeclarationId: jest.fn(),
      findPendingSettlementsByCompany: jest.fn(),
      registerSettlementPayment: jest.fn(),
    };

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

    useCase = new PaySettlementUseCase(mockSettlementRepo, mockShipmentRepo);
  });

  it('debe lanzar NotFoundException si la liquidación no existe', async () => {
    mockSettlementRepo.findSettlementById.mockResolvedValue(null);

    await expect(
      useCase.execute('invalid-id', { bank_code: 'BCP', bank_operation_number: '123' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar BadRequestException si la liquidación ya está pagada', async () => {
    mockSettlementRepo.findSettlementById.mockResolvedValue({
      id: 'settle-1',
      cda_number: '11826100104589',
      status: SettlementStatus.PAGADA,
    });

    await expect(
      useCase.execute('settle-1', { bank_code: 'BCP', bank_operation_number: '123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe asentar el pago bancario y actualizar estado a CON_LEVANTE para canal VERDE', async () => {
    mockSettlementRepo.findSettlementById.mockResolvedValue({
      id: 'settle-1',
      declaration_id: 'decl-1',
      cda_number: '11826100104589',
      amount_pen: 15400,
      status: SettlementStatus.GENERADA,
      declaration: {
        shipment_id: 'ship-100',
        company_id: 'comp-1',
        channel: 'VERDE',
      },
    });

    mockSettlementRepo.registerSettlementPayment.mockResolvedValue({
      id: 'settle-1',
      status: SettlementStatus.PAGADA,
    });

    mockSettlementRepo.findSettlementsByDeclarationId.mockResolvedValue([
      { id: 'settle-1', status: SettlementStatus.PAGADA },
    ]);

    const result = await useCase.execute(
      'settle-1',
      {
        bank_code: 'BCP',
        bank_operation_number: 'OP-998877',
        paid_at: '2026-03-20T12:00:00Z',
        voucher_storage_url: 'https://vouchers.com/v1.pdf',
      },
      'comp-1',
    );

    expect(result.status).toBe(SettlementStatus.PAGADA);
    expect(mockSettlementRepo.registerSettlementPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementId: 'settle-1',
        bankCode: 'BCP',
        bankOperationNumber: 'OP-998877',
      }),
    );
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-100',
        eventType: 'PAGO_TRIBUTOS',
      }),
    );
    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-100',
      'comp-1',
      ShipmentStatus.CON_LEVANTE,
    );
  });

  it('no debe cambiar estado a CON_LEVANTE si el canal es ROJO', async () => {
    mockSettlementRepo.findSettlementById.mockResolvedValue({
      id: 'settle-2',
      declaration_id: 'decl-2',
      cda_number: '11826100104590',
      amount_pen: 5000,
      status: SettlementStatus.GENERADA,
      declaration: {
        shipment_id: 'ship-200',
        company_id: 'comp-1',
        channel: 'ROJO',
      },
    });

    mockSettlementRepo.registerSettlementPayment.mockResolvedValue({
      id: 'settle-2',
      status: SettlementStatus.PAGADA,
    });

    mockSettlementRepo.findSettlementsByDeclarationId.mockResolvedValue([
      { id: 'settle-2', status: SettlementStatus.PAGADA },
    ]);

    await useCase.execute('settle-2', {
      bank_code: 'BBVA',
      bank_operation_number: 'OP-1111',
    });

    expect(mockShipmentRepo.updateShipmentStatus).not.toHaveBeenCalled();
  });
});
