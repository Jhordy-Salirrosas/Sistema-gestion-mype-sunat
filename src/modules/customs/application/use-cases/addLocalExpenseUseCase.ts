import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AddLocalExpenseDto } from '../dto/addLocalExpenseDto';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';

@Injectable()
export class AddLocalExpenseUseCase {
  constructor(
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(dto: AddLocalExpenseDto, companyId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findShipmentById(dto.shipment_id, companyId);
    if (!shipment) {
      throw new NotFoundException(
        `Expediente con ID '${dto.shipment_id}' no encontrado en su empresa`,
      );
    }

    const expense = await this.landedCostRepository.addLocalExpense({
      shipmentId: dto.shipment_id,
      supplierRuc: dto.supplier_ruc,
      supplierName: dto.supplier_name,
      expenseConcept: dto.expense_concept,
      invoiceSerialNumber: dto.invoice_serial_number,
      issueDate: new Date(dto.issue_date),
      netAmountPen: dto.net_amount_pen,
      igvAmountPen: dto.igv_amount_pen,
      totalAmountPen: dto.total_amount_pen,
      spotDetractionRate: dto.spot_detraction_rate ?? 0.0,
      isCapitalizable: dto.is_capitalizable ?? true,
      prorationMethod: dto.proration_method ?? 'VALOR_FOB',
    });

    await this.shipmentRepository.addEvent({
      shipmentId: dto.shipment_id,
      eventType: 'GASTO_LOCAL',
      eventTimestamp: new Date(),
      registeredBy: 'CONTABILIDAD',
      referenceCode: dto.invoice_serial_number,
      eventValue: `${dto.expense_concept} | Neto: S/ ${Number(dto.net_amount_pen).toFixed(2)} | Prov: ${dto.supplier_name}`,
    });

    return expense;
  }
}
