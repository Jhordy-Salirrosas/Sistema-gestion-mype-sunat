import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RegisterDuaDto } from '../dto/registerDuaDto';
import { DuaNumberVO } from '../../domain/value-objects/duaNumberVo';
import { CalculateCifRule } from '../../domain/rules/calculateCifRule';
import { CalculateCustomsTaxesRule } from '../../domain/rules/calculateCustomsTaxesRule';
import { CustomsDeclarationEntity } from '../../domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../domain/entities/customsItemEntity';
import { CUSTOMS_REPOSITORY_PORT } from '../../domain/ports/customsRepositoryPort';
import type {
  ICustomsRepositoryPort,
  KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';

export interface RegisteredDuaItemResponse {
  id?: string;
  item_order: number;
  item_code?: string;
  hs_code: string;
  commercial_description: string;
  quantity: number;
  fob_total_usd: number;
  allocated_cif_pen: number;
  allocated_duties_pen: number;
  landed_cost_unit_pen: number;
}

export interface RegisteredDuaResponse {
  id?: string;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  numeration_date: Date;
  cif_value_usd: number;
  cif_value_pen: number;
  ad_valorem_amount_pen: number;
  igv_ipm_amount_pen: number;
  perception_amount_pen: number;
  total_customs_taxes_pen: number;
  status: string;
  items_count: number;
  items: RegisteredDuaItemResponse[];
  kardex_movements_registered: number;
  created_at?: Date;
}

@Injectable()
export class RegisterDuaUseCase {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(dto: RegisterDuaDto, companyId: string): Promise<RegisteredDuaResponse> {
    // 1. Validar formato de la DUA usando Value Object
    try {
      new DuaNumberVO(dto.dua_number);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Número de DUA/DAM inválido',
      );
    }

    // 2. Validar integridad de cuadre FOB de los ítems vs cabecera
    const calculatedItemsFobTotal = dto.items.reduce(
      (sum, item) => sum + Number((item.quantity * item.fob_unit_usd).toFixed(2)),
      0,
    );

    const roundedItemsFob = Number(calculatedItemsFobTotal.toFixed(2));
    const roundedHeaderFob = Number(dto.fob_value_usd.toFixed(2));

    if (Math.abs(roundedItemsFob - roundedHeaderFob) > 0.01) {
      throw new BadRequestException(
        `FOB sum mismatch: Items total (${roundedItemsFob.toFixed(2)}) does not match declaration FOB (${roundedHeaderFob.toFixed(2)})`,
      );
    }

    // 3. Aplicar reglas puras de cálculo de CIF e Impuestos
    const cif = CalculateCifRule.execute({
      fobUsd: dto.fob_value_usd,
      freightUsd: dto.freight_value_usd,
      insuranceUsd: dto.insurance_value_usd,
      exchangeRate: dto.exchange_rate,
    });

    const taxes = CalculateCustomsTaxesRule.execute({
      cifPen: cif.cifPen,
      adValoremRate: dto.ad_valorem_rate,
      perceptionRate: dto.perception_rate,
    });

    // 4. Prorrateo de Landed Cost por ítem y cálculo de Kardex Promedio Ponderado
    const customsItems: CustomsItemEntity[] = [];
    const kardexMovements: KardexMovementRecord[] = [];

    for (const itemDto of dto.items) {
      const fobTotalUsd = Number((itemDto.quantity * itemDto.fob_unit_usd).toFixed(2));
      const fobFactor = dto.fob_value_usd > 0 ? fobTotalUsd / dto.fob_value_usd : 0;

      const allocatedCifPen = Number((cif.cifPen * fobFactor).toFixed(2));
      const allocatedDutiesPen = Number((taxes.adValoremAmountPen * fobFactor).toFixed(2));
      const totalItemLandedPen = Number((allocatedCifPen + allocatedDutiesPen).toFixed(2));
      const landedCostUnitPen = Number((totalItemLandedPen / itemDto.quantity).toFixed(4));
      const itemCode = (itemDto.item_code?.trim() || itemDto.hs_code).trim();

      const itemEntity = new CustomsItemEntity({
        itemOrder: itemDto.item_order,
        itemCode,
        hsCode: itemDto.hs_code,
        commercialDescription: itemDto.commercial_description,
        quantity: itemDto.quantity,
        unitCode: itemDto.unit_code,
        fobUnitUsd: itemDto.fob_unit_usd,
        fobTotalUsd,
        allocatedCifPen,
        allocatedDutiesPen,
        landedCostUnitPen,
      });

      customsItems.push(itemEntity);

      // 5. Consultar saldo previo para Kardex Promedio Ponderado Móvil
      const previousMovement = await this.customsRepository.findLatestKardexMovementByItem(
        companyId,
        itemCode,
      );

      const previousStock = previousMovement ? Number(previousMovement.finalStockQuantity) : 0;
      const previousAvgCost = previousMovement ? Number(previousMovement.finalAverageUnitCost) : 0;

      const newStock = Number((previousStock + itemDto.quantity).toFixed(4));
      let newAverageUnitCost = landedCostUnitPen;

      if (previousStock > 0 && newStock > 0) {
        const previousTotal = previousStock * previousAvgCost;
        const currentTotal = itemDto.quantity * landedCostUnitPen;
        newAverageUnitCost = Number(((previousTotal + currentTotal) / newStock).toFixed(4));
      }

      const finalTotalInventoryValue = Number((newStock * newAverageUnitCost).toFixed(2));

      kardexMovements.push({
        companyId,
        movementDate: new Date(dto.numeration_date),
        movementType: 'INGRESO_IMPORTACION',
        itemCode,
        description: itemDto.commercial_description,
        sourceReferenceId: dto.dua_number,
        quantityIn: itemDto.quantity,
        unitCostIn: landedCostUnitPen,
        totalCostIn: totalItemLandedPen,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: newStock,
        finalAverageUnitCost: newAverageUnitCost,
        finalTotalInventoryValue,
      });
    }

    // 6. Instanciar agregado raíz CustomsDeclarationEntity
    const declarationEntity = new CustomsDeclarationEntity({
      companyId,
      duaNumber: dto.dua_number,
      customsAgencyCode: dto.customs_agency_code,
      regimeCode: dto.regime_code ?? '10',
      numerationDate: new Date(dto.numeration_date),
      fobValueUsd: dto.fob_value_usd,
      freightValueUsd: dto.freight_value_usd,
      insuranceValueUsd: dto.insurance_value_usd,
      cifValueUsd: cif.cifUsd,
      exchangeRate: dto.exchange_rate,
      cifValuePen: cif.cifPen,
      adValoremRate: dto.ad_valorem_rate,
      adValoremAmountPen: taxes.adValoremAmountPen,
      igvRate: 16.0,
      ipmRate: 2.0,
      igvIpmAmountPen: taxes.igvIpmAmountPen,
      perceptionRate: dto.perception_rate,
      perceptionAmountPen: taxes.perceptionAmountPen,
      totalCustomsTaxesPen: taxes.totalCustomsTaxesPen,
      status: 'LIQUIDADO',
      items: customsItems,
    });

    // 7. Persistir atómicamente cabecera, series y Kardex
    const savedDeclaration = await this.customsRepository.saveDeclarationWithItemsAndKardex(
      declarationEntity,
      customsItems,
      kardexMovements,
    );

    // 8. Construir respuesta formal
    return {
      id: savedDeclaration.id,
      dua_number: savedDeclaration.duaNumber,
      customs_agency_code: savedDeclaration.customsAgencyCode,
      regime_code: savedDeclaration.regimeCode,
      numeration_date: savedDeclaration.numerationDate,
      cif_value_usd: savedDeclaration.cifValueUsd,
      cif_value_pen: savedDeclaration.cifValuePen,
      ad_valorem_amount_pen: savedDeclaration.adValoremAmountPen,
      igv_ipm_amount_pen: savedDeclaration.igvIpmAmountPen,
      perception_amount_pen: savedDeclaration.perceptionAmountPen,
      total_customs_taxes_pen: savedDeclaration.totalCustomsTaxesPen,
      status: savedDeclaration.status,
      items_count: savedDeclaration.items.length,
      items: savedDeclaration.items.map((item) => ({
        id: item.id,
        item_order: item.itemOrder,
        item_code: item.itemCode,
        hs_code: item.hsCode,
        commercial_description: item.commercialDescription,
        quantity: item.quantity,
        fob_total_usd: item.fobTotalUsd,
        allocated_cif_pen: item.allocatedCifPen,
        allocated_duties_pen: item.allocatedDutiesPen,
        landed_cost_unit_pen: item.landedCostUnitPen,
      })),
      kardex_movements_registered: kardexMovements.length,
      created_at: savedDeclaration.createdAt,
    };
  }
}
