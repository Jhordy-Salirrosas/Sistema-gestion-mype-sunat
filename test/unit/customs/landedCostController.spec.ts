import { UnauthorizedException } from '@nestjs/common';
import { LandedCostController } from '../../../src/modules/customs/infrastructure/controllers/landedCostController';
import { AddLocalExpenseUseCase } from '../../../src/modules/customs/application/use-cases/addLocalExpenseUseCase';
import { CalculateLandedCostUseCase } from '../../../src/modules/customs/application/use-cases/calculateLandedCostUseCase';
import { ApproveLandedCostSheetUseCase } from '../../../src/modules/customs/application/use-cases/approveLandedCostSheetUseCase';
import { AdjustLateImportCostUseCase } from '../../../src/modules/customs/application/use-cases/adjustLateImportCostUseCase';
import type { ILandedCostRepositoryPort } from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import { AddLocalExpenseDto } from '../../../src/modules/customs/application/dto/addLocalExpenseDto';
import { CalculateLandedCostDto } from '../../../src/modules/customs/application/dto/calculateLandedCostDto';
import { ApproveLandedCostDto } from '../../../src/modules/customs/application/dto/approveLandedCostDto';
import { AdjustLateImportCostDto } from '../../../src/modules/customs/application/dto/adjustLateImportCostDto';

describe('LandedCostController', () => {
  let controller: LandedCostController;
  let mockAddExpense: jest.Mocked<AddLocalExpenseUseCase>;
  let mockCalculateLandedCost: jest.Mocked<CalculateLandedCostUseCase>;
  let mockApproveSheet: jest.Mocked<ApproveLandedCostSheetUseCase>;
  let mockAdjustLateCost: jest.Mocked<AdjustLateImportCostUseCase>;
  let mockLandedCostRepo: jest.Mocked<ILandedCostRepositoryPort>;

  beforeEach(() => {
    mockAddExpense = { execute: jest.fn() } as any;
    mockCalculateLandedCost = { execute: jest.fn() } as any;
    mockApproveSheet = { execute: jest.fn() } as any;
    mockAdjustLateCost = { execute: jest.fn() } as any;
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
      mockLandedCostRepo,
      mockApproveSheet,
      mockAdjustLateCost,
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
    mockAddExpense.execute.mockResolvedValue({ id: 'exp-1', total_amount_pen: 2950 } as any);

    const result = await controller.addExpense('comp-1', dto);

    expect(result.id).toBe('exp-1');
    expect(mockAddExpense.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe listar los gastos locales asociados a un embarque con companyId', async () => {
    mockLandedCostRepo.findLocalExpensesByShipmentId.mockResolvedValue([{ id: 'exp-1' }]);

    const result = await controller.getExpenses('ship-1', 'comp-1');

    expect(result).toHaveLength(1);
    expect(mockLandedCostRepo.findLocalExpensesByShipmentId).toHaveBeenCalledWith('ship-1', 'comp-1');
  });

  it('debe calcular la hoja de prorrateo Landed Cost conforme a NIC 2', async () => {
    const dto: CalculateLandedCostDto = { shipment_id: 'ship-1' };
    mockCalculateLandedCost.execute.mockResolvedValue({ sheet: { id: 'sheet-1' }, proration: {} } as any);

    const result = await controller.calculateLandedCost('comp-1', dto);

    expect(result.sheet.id).toBe('sheet-1');
    expect(mockCalculateLandedCost.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe consultar la hoja de costeo por id de embarque con companyId', async () => {
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({ id: 'sheet-1' });

    const result = await controller.getSheet('ship-1', 'comp-1');

    expect(result.id).toBe('sheet-1');
    expect(mockLandedCostRepo.findLandedCostSheetByShipmentId).toHaveBeenCalledWith('ship-1', 'comp-1');
  });

  it('debe aprobar formalmente la hoja de costos y notificar contabilidad', async () => {
    const dto: ApproveLandedCostDto = { shipmentId: 'ship-1', notes: 'Aprobado conforme' };
    mockApproveSheet.execute.mockResolvedValue({ id: 'sheet-1', status: 'APROBADO' } as any);

    const result = await controller.approveSheet('comp-1', dto);

    expect(result.status).toBe('APROBADO');
    expect(mockApproveSheet.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe procesar un ajuste posterior de importación (costo tardío)', async () => {
    const dto: AdjustLateImportCostDto = {
      shipmentId: 'ship-1',
      supplierRuc: '20100047218',
      supplierName: 'ALMACEN PORTUARIO',
      expenseConcept: 'ALMACENAJE_TARDIO',
      invoiceSerialNumber: 'F001-000999',
      issueDate: '2026-03-20T00:00:00.000Z',
      netAmountPen: 1000,
      igvAmountPen: 180,
      totalAmountPen: 1180,
      adjustmentJustification: 'Gasto portuario complementario',
    };
    mockAdjustLateCost.execute.mockResolvedValue({ id: 'adj-1' } as any);

    const result = await controller.adjustLateCost('comp-1', dto);

    expect(result.id).toBe('adj-1');
    expect(mockAdjustLateCost.execute).toHaveBeenCalledWith(dto, 'comp-1');
  });

  it('debe arrojar UnauthorizedException si falta companyId en cualquier endpoint', async () => {
    await expect(controller.addExpense(undefined, {} as any)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.getExpenses('ship-1', undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.calculateLandedCost(undefined, {} as any)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.getSheet('ship-1', undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.approveSheet(undefined, {} as any)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.adjustLateCost(undefined, {} as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe arrojar Error si no están inyectados los casos de uso opcionales', async () => {
    const bareController = new LandedCostController(
      mockAddExpense,
      mockCalculateLandedCost,
      mockLandedCostRepo,
      undefined,
      undefined,
    );

    await expect(bareController.approveSheet('comp-1', {} as any)).rejects.toThrow(
      'ApproveLandedCostSheetUseCase no está inyectado',
    );
    await expect(bareController.adjustLateCost('comp-1', {} as any)).rejects.toThrow(
      'AdjustLateImportCostUseCase no está inyectado',
    );
  });
});
