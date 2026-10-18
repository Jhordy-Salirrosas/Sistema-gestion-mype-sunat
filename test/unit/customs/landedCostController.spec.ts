import { LandedCostController } from '../../../src/modules/customs/infrastructure/controllers/landedCostController';
import { AddLocalExpenseUseCase } from '../../../src/modules/customs/application/use-cases/addLocalExpenseUseCase';
import { CalculateLandedCostUseCase } from '../../../src/modules/customs/application/use-cases/calculateLandedCostUseCase';
import { ApplyLandedCostToKardexUseCase } from '../../../src/modules/customs/application/use-cases/applyLandedCostToKardexUseCase';
import type { ILandedCostRepositoryPort } from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import { AddLocalExpenseDto } from '../../../src/modules/customs/application/dto/addLocalExpenseDto';
import { CalculateLandedCostDto } from '../../../src/modules/customs/application/dto/calculateLandedCostDto';
import { ApplyLandedCostToKardexDto } from '../../../src/modules/customs/application/dto/applyLandedCostToKardexDto';

describe('LandedCostController', () => {
  let controller: LandedCostController;
  let mockAddExpense: jest.Mocked<AddLocalExpenseUseCase>;
  let mockCalculateLandedCost: jest.Mocked<CalculateLandedCostUseCase>;
  let mockApplyToKardex: jest.Mocked<ApplyLandedCostToKardexUseCase>;
  let mockLandedCostRepo: jest.Mocked<ILandedCostRepositoryPort>;

  beforeEach(() => {
    mockAddExpense = { execute: jest.fn() } as any;
    mockCalculateLandedCost = { execute: jest.fn() } as any;
    mockApplyToKardex = { execute: jest.fn() } as any;
    mockLandedCostRepo = {
      addLocalExpense: jest.fn(),
      findLocalExpensesByShipmentId: jest.fn(),
      deleteLocalExpense: jest.fn(),
      saveLandedCostSheet: jest.fn(),
      findLandedCostSheetByShipmentId: jest.fn(),
    };

    controller = new LandedCostController(
      mockAddExpense,
      mockCalculateLandedCost,
      mockApplyToKardex,
      mockLandedCostRepo,
    );
  });

  it('debe registrar un gasto local de desaduanaje', async () => {
    const dto: AddLocalExpenseDto = {
      shipment_id: 'ship-1',
      supplier_ruc: '20100047218',
      supplier_name: 'ALMACEN PORTUARIO',
      expense_concept: 'ALMACENAJE',
      invoice_serial_number: 'F001-000123',
      issue_date: '2026-03-15T00:00:00.000Z',
      net_amount_pen: 2500,
      igv_amount_pen: 450,
      total_amount_pen: 2950,
    };
    mockAddExpense.execute.mockResolvedValue({ id: 'exp-1', total_amount_pen: 2950 });

    const result = await controller.addExpense('comp-1', dto);

    expect(result.id).toBe('exp-1');
    expect(mockAddExpense.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe listar los gastos locales asociados a un embarque', async () => {
    mockLandedCostRepo.findLocalExpensesByShipmentId.mockResolvedValue([{ id: 'exp-1' }]);

    const result = await controller.getExpenses('ship-1');

    expect(result).toHaveLength(1);
    expect(mockLandedCostRepo.findLocalExpensesByShipmentId).toHaveBeenCalledWith('ship-1');
  });

  it('debe calcular la hoja de prorrateo Landed Cost conforme a NIC 2', async () => {
    const dto: CalculateLandedCostDto = { shipment_id: 'ship-1' };
    mockCalculateLandedCost.execute.mockResolvedValue({ sheet: { id: 'sheet-1' }, proration: {} });

    const result = await controller.calculateLandedCost('comp-1', dto);

    expect(result.sheet.id).toBe('sheet-1');
    expect(mockCalculateLandedCost.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe asentar el costo de adquisición al Kardex valorizado', async () => {
    const dto: ApplyLandedCostToKardexDto = { shipment_id: 'ship-1' };
    mockApplyToKardex.execute.mockResolvedValue({ message: 'OK', movements_count: 1 });

    const result = await controller.applyToKardex('comp-1', dto);

    expect(result.movements_count).toBe(1);
    expect(mockApplyToKardex.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe consultar la hoja de costeo por id de embarque', async () => {
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({ id: 'sheet-1' });

    const result = await controller.getSheet('ship-1');

    expect(result.id).toBe('sheet-1');
    expect(mockLandedCostRepo.findLandedCostSheetByShipmentId).toHaveBeenCalledWith('ship-1');
  });
});
