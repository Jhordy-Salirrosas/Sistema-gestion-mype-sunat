import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  CreateLocalExpenseData,
  ILandedCostRepositoryPort,
  SaveLandedCostSheetData,
} from '../../domain/ports/landedCostRepositoryPort';
import { LandedCostStatus } from '../../domain/enums/landedCostStatus.enum';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class PrismaLandedCostRepository implements ILandedCostRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async addLocalExpense(data: CreateLocalExpenseData): Promise<any> {
    return this.prisma.localExpenseInvoice.create({
      data: {
        shipment_id: data.shipmentId,
        supplier_ruc: data.supplierRuc,
        supplier_name: data.supplierName,
        expense_concept: data.expenseConcept,
        invoice_serial_number: data.invoiceSerialNumber,
        issue_date: data.issueDate,
        net_amount_pen: data.netAmountPen,
        igv_amount_pen: data.igvAmountPen,
        total_amount_pen: data.totalAmountPen,
        spot_detraction_rate: data.spotDetractionRate ?? 0.0,
        is_capitalizable: data.isCapitalizable ?? true,
        proration_method: data.prorationMethod ?? 'VALOR_FOB',
      },
    });
  }

  async findLocalExpensesByShipmentId(shipmentId: string): Promise<any[]> {
    return this.prisma.localExpenseInvoice.findMany({
      where: { shipment_id: shipmentId },
      orderBy: { issue_date: 'asc' },
    });
  }

  async deleteLocalExpense(expenseId: string): Promise<void> {
    await this.prisma.localExpenseInvoice.delete({
      where: { id: expenseId },
    });
  }

  async saveLandedCostSheet(data: SaveLandedCostSheetData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Crear o actualizar la hoja de liquidación
      const sheet = await tx.landedCostSheet.upsert({
        where: { shipment_id: data.shipmentId },
        create: {
          shipment_id: data.shipmentId,
          total_cif_pen: data.totalCifPen,
          total_duties_pen: data.totalDutiesPen,
          total_local_expenses_pen: data.totalLocalExpensesPen,
          total_inventory_cost_pen: data.totalInventoryCostPen,
          status: (data.status ?? LandedCostStatus.DEFINITIVO) as any,
          approved_by_accountant: data.approvedByAccountant ?? true,
          approved_at: new Date(),
        },
        update: {
          total_cif_pen: data.totalCifPen,
          total_duties_pen: data.totalDutiesPen,
          total_local_expenses_pen: data.totalLocalExpensesPen,
          total_inventory_cost_pen: data.totalInventoryCostPen,
          status: (data.status ?? LandedCostStatus.DEFINITIVO) as any,
          approved_by_accountant: data.approvedByAccountant ?? true,
          approved_at: new Date(),
        },
      });

      // 2. Actualizar ítems declarados con el costo prorrateado y unitario
      for (const item of data.itemsProration) {
        await tx.customsItem.update({
          where: { id: item.itemId },
          data: {
            allocated_local_cost_pen: item.allocatedLocalCostPen,
            final_landed_cost_unit_pen: item.finalLandedCostUnitPen,
          },
        });
      }

      // 3. Actualizar estado del embarque a COSTEADO
      await tx.customsShipment.update({
        where: { id: data.shipmentId },
        data: { status: ShipmentStatus.COSTEADO as any },
      });

      return sheet;
    });
  }

  async findLandedCostSheetByShipmentId(shipmentId: string): Promise<any | null> {
    return this.prisma.landedCostSheet.findUnique({
      where: { shipment_id: shipmentId },
      include: {
        shipment: {
          include: {
            local_expenses: true,
            declarations: {
              include: {
                items: true,
              },
            },
          },
        },
      },
    });
  }
}
