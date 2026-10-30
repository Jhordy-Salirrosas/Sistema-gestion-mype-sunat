import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import { AdjustLateImportCostDto } from '../dto/adjustLateImportCostDto';
import { LandedCostStatus } from '../../domain/enums/landedCostStatus.enum';

@Injectable()
export class AdjustLateImportCostUseCase {
  constructor(
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(dto: AdjustLateImportCostDto, companyId: string): Promise<any> {
    // 1. Validar existencia del expediente y pertenencia a la empresa
    const shipment = await this.shipmentRepository.findShipmentById(dto.shipmentId, companyId);
    if (!shipment) {
      throw new NotFoundException(
        `Expediente con ID '${dto.shipmentId}' no encontrado para esta empresa.`,
      );
    }

    // 2. Registrar el comprobante de gasto tardío (ej. Demurrage, sobreestadía)
    const expense = await this.landedCostRepository.addLocalExpense({
      shipmentId: dto.shipmentId,
      supplierRuc: dto.supplierRuc,
      supplierName: dto.supplierName,
      expenseConcept: dto.expenseConcept,
      invoiceSerialNumber: dto.invoiceSerialNumber,
      issueDate: new Date(dto.issueDate),
      netAmountPen: dto.netAmountPen,
      igvAmountPen: dto.igvAmountPen,
      totalAmountPen: dto.totalAmountPen,
      isCapitalizable: dto.isCapitalizable ?? true,
      prorationMethod: dto.prorationMethod ?? 'VALOR_FOB',
    });

    // 3. Si existe una hoja de costos previa, marcarla en estado de ajuste
    const currentSheet = await this.landedCostRepository.findLandedCostSheetByShipmentId(
      dto.shipmentId,
      companyId,
    );

    if (currentSheet) {
      await this.landedCostRepository.saveLandedCostSheet({
        shipmentId: dto.shipmentId,
        totalCifPen: Number(currentSheet.total_cif_pen),
        totalDutiesPen: Number(currentSheet.total_duties_pen),
        totalLocalExpensesPen: Number(currentSheet.total_local_expenses_pen) + dto.netAmountPen,
        totalInventoryCostPen: Number(currentSheet.total_inventory_cost_pen) + dto.netAmountPen,
        status: LandedCostStatus.A_RECALCULAR,
        approvedByAccountant: false,
        itemsProration: [],
      });
    }

    return {
      message: 'Gasto extemporáneo registrado exitosamente. La hoja de costos fue marcada para recálculo/ajuste.',
      expense,
      requiresRecalculation: true,
    };
  }
}

