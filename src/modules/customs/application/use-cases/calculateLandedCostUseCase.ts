import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CalculateLandedCostDto } from '../dto/calculateLandedCostDto';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import {
  ProrationEngine,
  type LocalExpenseInput,
  type ProrationItemInput,
  type ProrationResult,
} from '../../domain/rules/ProrationEngine';
import { LandedCostStatus } from '../../domain/enums/landedCostStatus.enum';

@Injectable()
export class CalculateLandedCostUseCase {
  constructor(
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(dto: CalculateLandedCostDto, companyId: string): Promise<any> {
    // 1. Obtener expediente con sus declaraciones, ítems y gastos
    const shipment = await this.shipmentRepository.findShipmentById(dto.shipment_id, companyId);
    if (!shipment) {
      throw new NotFoundException(
        `Expediente con ID '${dto.shipment_id}' no encontrado en su empresa`,
      );
    }

    if (!shipment.declarations || shipment.declarations.length === 0) {
      throw new BadRequestException(
        `El expediente '${shipment.shipment_number}' no cuenta con declaraciones DAM/DUA registradas`,
      );
    }

    // 2. Extraer ítems a costear de la declaración
    const declaration = shipment.declarations[0];
    if (!declaration.items || declaration.items.length === 0) {
      throw new BadRequestException(
        `La DAM '${declaration.dua_number}' no contiene ítems para realizar el prorrateo de costos`,
      );
    }

    const prorationItems: ProrationItemInput[] = declaration.items.map((item: any) => ({
      itemId: item.id,
      itemCode: (item.product_code ?? item.productCode ?? item.hs_code ?? item.hsCode ?? '').trim(),
      description: item.commercial_description ?? item.commercialDescription ?? 'Item',
      quantity: Number(item.quantity ?? 1),
      netWeightKg: Number(item.net_weight_kg ?? item.netWeightKg ?? 1.0),
      fobUsd: Number(item.fob_total_usd ?? item.fobTotalUsd ?? (Number(item.fob_unit_usd ?? item.fobUnitUsd ?? 0) * Number(item.quantity ?? 1))),
      cifPen: Number(item.allocated_cif_pen ?? item.allocatedCifPen ?? 0),
      adValoremPen: Number(item.allocated_duties_pen ?? item.allocatedDutiesPen ?? 0),
    }));

    // 3. Extraer comprobantes de gastos locales (NIC 2: solo capitalizables y monto NETO sin IGV)
    const localExpenses = await this.landedCostRepository.findLocalExpensesByShipmentId(
      dto.shipment_id,
    );

    const expenseInputs: LocalExpenseInput[] = localExpenses
      .filter((exp: any) => (exp.is_capitalizable ?? exp.isCapitalizable) !== false)
      .map((exp: any) => ({
        expenseId: exp.id,
        concept: exp.expense_concept ?? exp.expenseConcept ?? 'GASTO_LOCAL',
        supplierRuc: exp.supplier_ruc ?? exp.supplierRuc,
        invoiceNumber: exp.invoice_serial_number ?? exp.invoiceSerialNumber,
        netAmountPen: Number(exp.net_amount_pen ?? exp.netAmountPen ?? 0), // Exclusión estricta del IGV (Crédito Fiscal)
        prorationMethod: (exp.proration_method ?? exp.prorationMethod ?? 'VALOR_FOB') as any,
        isCapitalizable: (exp.is_capitalizable ?? exp.isCapitalizable) ?? true,
      }));

    // 4. Ejecutar motor matemático puro de prorrateo Landed Cost (NIC 2)
    const prorationResult: ProrationResult = ProrationEngine.calculateLandedCost(
      prorationItems,
      expenseInputs,
    );

    // 5. Persistir hoja de liquidación y actualizar costos unitarios de los ítems
    const savedSheet = await this.landedCostRepository.saveLandedCostSheet({
      shipmentId: dto.shipment_id,
      totalCifPen: prorationResult.totalCifPen,
      totalDutiesPen: prorationResult.totalDutiesPen,
      totalLocalExpensesPen: prorationResult.totalLocalExpensesPen,
      totalInventoryCostPen: prorationResult.totalInventoryCostPen,
      status: LandedCostStatus.DEFINITIVO,
      approvedByAccountant: dto.approved_by_accountant ?? true,
      itemsProration: prorationResult.items.map((p) => ({
        itemId: p.itemId,
        allocatedLocalCostPen: p.totalAllocatedLocalExpensesPen,
        finalLandedCostUnitPen: p.unitLandedCostPen,
      })),
    });

    // 6. Registrar evento en la bitácora
    await this.shipmentRepository.addEvent({
      shipmentId: dto.shipment_id,
      eventType: 'COSTEO_LANDED_COST',
      eventTimestamp: new Date(),
      registeredBy: 'CONTABILIDAD',
      referenceCode: shipment.shipment_number,
      eventValue: `Total Inventario: S/ ${prorationResult.totalInventoryCostPen.toFixed(2)} | Gastos Locales: S/ ${prorationResult.totalLocalExpensesPen.toFixed(2)}`,
    });

    return {
      sheet: savedSheet,
      proration: prorationResult,
    };
  }
}
