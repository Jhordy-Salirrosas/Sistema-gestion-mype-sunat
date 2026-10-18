import { BadRequestException } from '@nestjs/common';
import { RegisterDuaWizardUseCase } from '../../../src/modules/customs/application/use-cases/registerDuaWizardUseCase';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import type { ICustomsRepositoryPort } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import type { ICustomsSettlementRepositoryPort } from '../../../src/modules/customs/domain/ports/customsSettlementRepositoryPort';

describe('RegisterDuaWizardUseCase', () => {
  let useCase: RegisterDuaWizardUseCase;
  let mockCustomsRepo: jest.Mocked<ICustomsRepositoryPort>;
  let mockShipmentRepo: jest.Mocked<ICustomsShipmentRepositoryPort>;
  let mockSettlementRepo: jest.Mocked<ICustomsSettlementRepositoryPort>;

  beforeEach(() => {
    mockCustomsRepo = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
      registerKardexMovements: jest.fn(),
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
    mockSettlementRepo = {
      createSettlements: jest.fn(),
      findSettlementById: jest.fn(),
      findSettlementsByDeclarationId: jest.fn(),
      findPendingSettlementsByCompany: jest.fn(),
      registerSettlementPayment: jest.fn(),
    };
    useCase = new RegisterDuaWizardUseCase(
      mockCustomsRepo,
      mockShipmentRepo,
      mockSettlementRepo,
    );
  });

  it('debe registrar la DAM con liquidación tributaria y generar liquidaciones CDA (Cuotas 0010 y 0026)', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-123',
      shipment_number: 'EXP-2026-0001',
    });
    mockCustomsRepo.saveDeclarationWithItemsAndKardex.mockImplementation(async (decl) => {
      return new CustomsDeclarationEntity({
        ...decl.toPrimitives(),
        id: 'decl-123',
      });
    });
    mockSettlementRepo.createSettlements.mockResolvedValue([
      { id: 'sett-1', settlement_type: 'TIPO_0010_DECLARACION', cda_number: '11820260010001' },
      { id: 'sett-2', settlement_type: 'TIPO_0026_MAYOR_VALOR', cda_number: '11820260026001' },
    ]);
    mockShipmentRepo.updateShipmentStatus.mockResolvedValue({ id: 'ship-123' });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-1' });

    const result = await useCase.execute(
      {
        shipment_id: 'ship-123',
        dua_number: '118-2026-10-001234',
        customs_agency_code: '118',
        regime_code: '10',
        dispatch_mode: '10',
        numeration_date: '2026-03-15T00:00:00.000Z',
        fob_value_usd: 50000.0,
        freight_value_usd: 3000.0,
        insurance_value_usd: 0, // Supletorio TPPS
        exchange_rate: 3.75,
        ad_valorem_rate: 0.0, // Laptops
        perception_rate: 3.5,
        channel: 'VERDE',
        items: [
          {
            item_order: 1,
            hs_code: '8471300000',
            commercial_description: 'LAPTOP LENOVO THINKPAD',
            quantity: 100,
            unit_code: 'NIU',
            fob_unit_usd: 500.0,
          },
        ],
      },
      'comp-1',
    );

    expect(result.declaration).toBeDefined();
    expect(result.taxBreakdown).toBeDefined();
    expect(result.taxBreakdown.isInsuranceTppsApplied).toBe(true);
    expect(result.settlements).toHaveLength(2);
    expect(mockSettlementRepo.createSettlements).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'NUMERACION',
      }),
    );
  });

  it('debe arrojar BadRequestException si el número de DUA tiene formato inválido', async () => {
    await expect(
      useCase.execute(
        {
          dua_number: 'DUA-INVALIDA',
          numeration_date: '2026-03-15T00:00:00.000Z',
          fob_value_usd: 1000,
          freight_value_usd: 100,
          exchange_rate: 3.75,
          ad_valorem_rate: 0,
          items: [
            {
              item_order: 1,
              hs_code: '8471300000',
              commercial_description: 'Item',
              quantity: 1,
              fob_unit_usd: 1000,
            },
          ],
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
