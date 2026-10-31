import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_EVENT_PUBLISHER_PORT,
  type ICustomsEventPublisherPort,
} from '../../domain/ports/customsEventPublisherPort';
import { ApproveLandedCostDto } from '../dto/approveLandedCostDto';
import { ImportCostApprovedEvent } from '../../domain/events/ImportCostApprovedEvent';
import { LandedCostStatus } from '../../domain/enums/landedCostStatus.enum';

@Injectable()
export class ApproveLandedCostSheetUseCase {
  constructor(
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Inject(CUSTOMS_EVENT_PUBLISHER_PORT)
    private readonly eventPublisher: ICustomsEventPublisherPort,
  ) {}

  async execute(dto: ApproveLandedCostDto, companyId: string): Promise<any> {
    // 1. Obtener la hoja de costos del expediente
    const sheet = await this.landedCostRepository.findLandedCostSheetByShipmentId(
      dto.shipmentId,
      companyId,
    );

    if (!sheet) {
      throw new NotFoundException(
        `Hoja de liquidación de costos no encontrada para el expediente '${dto.shipmentId}'.`,
      );
    }

    if (sheet.approved_by_accountant && sheet.status === LandedCostStatus.DEFINITIVO) {
      throw new BadRequestException(
        `La hoja de liquidación de costos del expediente '${dto.shipmentId}' ya se encuentra formalmente aprobada.`,
      );
    }

    // 2. Extraer ítems para valorización con su destino contable
    const declarations = sheet.shipment?.declarations || [];
    const costItems: any[] = [];

    for (const decl of declarations) {
      for (const item of decl.items || []) {
        const qty = Number(item.quantity);
        const unitCost = Number(item.final_landed_cost_unit_pen || item.landed_cost_unit_pen);
        const totalCost = Number((qty * unitCost).toFixed(2));

        costItems.push({
          productCode: item.product_code ?? item.hs_code,
          commercialDescription: item.commercial_description,
          quantity: qty,
          unitLandedCostPen: unitCost,
          totalLandedCostPen: totalCost,
          destinationType: item.destination_type ?? 'MERCADERIA',
        });
      }
    }

    // 3. Persistir actualización de aprobación
    const updatedSheet = await this.landedCostRepository.saveLandedCostSheet({
      shipmentId: dto.shipmentId,
      totalCifPen: Number(sheet.total_cif_pen),
      totalDutiesPen: Number(sheet.total_duties_pen),
      totalLocalExpensesPen: Number(sheet.total_local_expenses_pen),
      totalInventoryCostPen: Number(sheet.total_inventory_cost_pen),
      status: LandedCostStatus.DEFINITIVO,
      approvedByAccountant: true,
      itemsProration: (costItems || []).map((ci: any) => ({
        itemId: ci.productCode,
        allocatedLocalCostPen: 0,
        finalLandedCostUnitPen: ci.unitLandedCostPen,
      })),
    });

    // 4. Publicar evento de dominio hacia Inventario
    await this.eventPublisher.publishCostApproved(
      new ImportCostApprovedEvent({
        companyId,
        landedCostSheetId: sheet.id ?? `sheet-${dto.shipmentId}`,
        version: sheet.version ?? 1,
        shipmentId: dto.shipmentId,
        declarationId: dto.declarationId ?? (declarations[0]?.id || null),
        approvedAt: new Date(),
        totalCifPen: Number(sheet.total_cif_pen),
        totalDutiesPen: Number(sheet.total_duties_pen),
        totalLocalExpensesPen: Number(sheet.total_local_expenses_pen),
        totalInventoryCostPen: Number(sheet.total_inventory_cost_pen),
        costItems,
      }),
    );

    return {
      message: 'Hoja de liquidación de costos aprobada exitosamente y evento emitido a Inventario.',
      sheet: updatedSheet,
      costItemsCount: costItems.length,
      commercialItemsCount: costItems.filter((ci) => ci.destinationType === 'MERCADERIA').length,
      fixedAssetItemsCount: costItems.filter((ci) => ci.destinationType === 'ACTIVO_FIJO').length,
    };
  }
}

