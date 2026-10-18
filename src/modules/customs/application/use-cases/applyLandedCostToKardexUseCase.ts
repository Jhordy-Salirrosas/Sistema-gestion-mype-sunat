import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplyLandedCostToKardexDto } from '../dto/applyLandedCostToKardexDto';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
  type KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class ApplyLandedCostToKardexUseCase {
  constructor(
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(dto: ApplyLandedCostToKardexDto, companyId: string): Promise<any> {
    // 1. Validar existencia del expediente
    const shipment = await this.shipmentRepository.findShipmentById(dto.shipment_id, companyId);
    if (!shipment) {
      throw new NotFoundException(
        `Expediente con ID '${dto.shipment_id}' no encontrado en su empresa`,
      );
    }

    // 2. Validar que la hoja de Landed Cost exista y esté calculada
    const landedCostSheet = await this.landedCostRepository.findLandedCostSheetByShipmentId(
      dto.shipment_id,
    );
    if (!landedCostSheet) {
      throw new BadRequestException(
        `El expediente '${shipment.shipment_number}' no cuenta con una hoja de Landed Cost calculada y aprobada`,
      );
    }

    // 3. Obtener declaración e ítems
    const declaration = shipment.declarations?.[0];
    if (!declaration || !declaration.items || declaration.items.length === 0) {
      throw new BadRequestException(
        `No se encontraron declaraciones con ítems para asentar en el inventario`,
      );
    }

    const movementDate = dto.movement_date ? new Date(dto.movement_date) : new Date();
    const kardexMovements: KardexMovementRecord[] = [];

    // 4. Calcular balance bajo método de Promedio Ponderado Móvil para cada ítem
    for (const item of declaration.items) {
      const quantity = Number(item.quantity ?? 1);
      const landedUnit = Number(item.final_landed_cost_unit_pen ?? item.finalLandedCostUnitPen ?? item.landed_cost_unit_pen ?? item.landedCostUnitPen ?? 0);
      const unitCost = landedUnit > 0 ? landedUnit : Number(item.landed_cost_unit_pen ?? item.landedCostUnitPen ?? 0);
      const totalCostIn = Number((quantity * unitCost).toFixed(2));
      const itemCode = ((item.product_code ?? item.productCode)?.trim() || (item.hs_code ?? item.hsCode ?? '')).trim();

      // Consultar saldo inmediatamente anterior en el inventario
      const previousMovement = await this.customsRepository.findLatestKardexMovementByItem(
        companyId,
        itemCode,
      );

      const previousStock = previousMovement ? Number(previousMovement.finalStockQuantity) : 0;
      const previousAvgCost = previousMovement ? Number(previousMovement.finalAverageUnitCost) : 0;

      const newStock = Number((previousStock + quantity).toFixed(4));
      let newAverageUnitCost = unitCost;

      if (previousStock > 0 && newStock > 0) {
        const previousTotal = previousStock * previousAvgCost;
        const currentTotal = quantity * unitCost;
        newAverageUnitCost = Number(((previousTotal + currentTotal) / newStock).toFixed(4));
      }

      const finalTotalInventoryValue = Number((newStock * newAverageUnitCost).toFixed(2));

      kardexMovements.push({
        companyId,
        movementDate,
        movementType: 'INGRESO_IMPORTACION',
        itemCode,
        description: item.commercial_description ?? item.commercialDescription ?? 'Item',
        sourceReferenceId: declaration.dua_number,
        quantityIn: quantity,
        unitCostIn: unitCost,
        totalCostIn,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: newStock,
        finalAverageUnitCost: newAverageUnitCost,
        finalTotalInventoryValue,
      });
    }

    // 5. Persistir atómicamente los movimientos en el Kardex y actualizar estado de la DAM
    await this.customsRepository.registerKardexMovements(kardexMovements, declaration.id);

    // 6. Actualizar estado del expediente a CERRADO / COSTEADO
    await this.shipmentRepository.updateShipmentStatus(
      dto.shipment_id,
      companyId,
      ShipmentStatus.CERRADO,
    );

    // 7. Auditar hito en la bitácora
    await this.shipmentRepository.addEvent({
      shipmentId: dto.shipment_id,
      eventType: 'INGRESO_KARDEX',
      eventTimestamp: movementDate,
      registeredBy: 'ALMACEN_CENTRAL',
      referenceCode: declaration.dua_number,
      eventValue: `${kardexMovements.length} ítems ingresados al Kardex (Promedio Ponderado Móvil) | DAM: ${declaration.dua_number}`,
    });

    return {
      message: 'Ingreso al Kardex permanente valorizado completado con éxito',
      shipment_number: shipment.shipment_number,
      dua_number: declaration.dua_number,
      movements_count: kardexMovements.length,
      movements: kardexMovements,
    };
  }
}
