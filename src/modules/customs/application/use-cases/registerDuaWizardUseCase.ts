import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDuaWizardDto } from '../dto/registerDuaWizardDto';
import { DuaNumberVO } from '../../domain/value-objects/duaNumberVo';
import { HsCodeVO } from '../../domain/value-objects/hsCodeVo';
import {
  TaxLiquidationEngine,
  type TaxLiquidationResult,
} from '../../domain/rules/TaxLiquidationEngine';
import { CustomsDeclarationEntity } from '../../domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../domain/entities/customsItemEntity';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
} from '../../domain/ports/customsRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import {
  CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
  type ICustomsSettlementRepositoryPort,
  type CreateSettlementData,
} from '../../domain/ports/customsSettlementRepositoryPort';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class RegisterDuaWizardUseCase {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
    @Inject(CUSTOMS_SETTLEMENT_REPOSITORY_PORT)
    private readonly settlementRepository: ICustomsSettlementRepositoryPort,
  ) {}

  async execute(dto: RegisterDuaWizardDto, companyId: string): Promise<any> {
    // 1. Validar formato de la DUA usando Value Object
    try {
      new DuaNumberVO(dto.dua_number);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Número de DUA/DAM inválido',
      );
    }

    // 2. Validar cada Subpartida Nacional (SPN) usando Value Object
    for (const item of dto.items) {
      try {
        new HsCodeVO(item.hs_code);
      } catch (error) {
        throw new BadRequestException(
          `Ítem orden ${item.item_order}: ${error instanceof Error ? error.message : 'SPN inválida'}`,
        );
      }
    }

    // 3. Validar cuadre aritmético del FOB de los ítems vs cabecera
    const calculatedItemsFobTotal = dto.items.reduce(
      (sum, item) => sum + Number((item.quantity * item.fob_unit_usd).toFixed(2)),
      0,
    );
    const roundedItemsFob = Number(calculatedItemsFobTotal.toFixed(2));
    const roundedHeaderFob = Number(dto.fob_value_usd.toFixed(2));

    if (Math.abs(roundedItemsFob - roundedHeaderFob) > 0.01) {
      throw new BadRequestException(
        `Descuadre de FOB: La suma de ítems ($${roundedItemsFob.toFixed(2)}) no coincide con el FOB de cabecera ($${roundedHeaderFob.toFixed(2)})`,
      );
    }

    // 4. Si se especificó expediente de embarque, validar que exista
    if (dto.shipment_id) {
      const shipment = await this.shipmentRepository.findShipmentById(dto.shipment_id, companyId);
      if (!shipment) {
        throw new NotFoundException(
          `El expediente con ID '${dto.shipment_id}' no existe o no pertenece a su empresa`,
        );
      }
    }

    // 5. Aplicar motor puro de liquidación tributaria SUNAT
    const firstHsCode = dto.items[0]?.hs_code;
    const numerationDate = new Date(dto.numeration_date);
    const duaParts = dto.dua_number.split('-');
    const correlative = duaParts[3] || '000001';

    const taxResult: TaxLiquidationResult = TaxLiquidationEngine.calculate({
      fobUsd: dto.fob_value_usd,
      freightUsd: dto.freight_value_usd,
      insuranceUsd: dto.insurance_value_usd,
      hsCode: firstHsCode,
      exchangeRate: dto.exchange_rate,
      adValoremRate: dto.ad_valorem_rate,
      perceptionRate: dto.perception_rate ?? 3.5,
      customsCode: dto.customs_agency_code ?? '118',
      declarationYear: numerationDate.getFullYear(),
      declarationCorrelative: correlative,
    });

    // 6. Prorrateo preliminar a nivel de ítems
    const customsItems: CustomsItemEntity[] = dto.items.map((itemDto) => {
      const fobTotalUsd = Number((itemDto.quantity * itemDto.fob_unit_usd).toFixed(2));
      const fobFactor = dto.fob_value_usd > 0 ? fobTotalUsd / dto.fob_value_usd : 0;
      const allocatedCifPen = Number((taxResult.cifPen * fobFactor).toFixed(2));
      const allocatedDutiesPen = Number((taxResult.adValoremPen * fobFactor).toFixed(2));
      const initialLandedCostPen = Number((allocatedCifPen + allocatedDutiesPen).toFixed(2));
      const landedCostUnitPen = Number((initialLandedCostPen / itemDto.quantity).toFixed(4));
      const itemCode = (itemDto.product_code?.trim() || itemDto.hs_code).trim();

      return new CustomsItemEntity({
        itemOrder: itemDto.item_order,
        seriesOrder: itemDto.series_order ?? itemDto.item_order,
        productCode: itemDto.product_code,
        itemCode,
        hsCode: itemDto.hs_code,
        commercialDescription: itemDto.commercial_description,
        goodsState: itemDto.goods_state ?? 'NUEVO',
        quantity: itemDto.quantity,
        unitCode: itemDto.unit_code ?? 'NIU',
        netWeightKg: itemDto.net_weight_kg ?? null,
        grossWeightKg: itemDto.gross_weight_kg ?? null,
        fobUnitUsd: itemDto.fob_unit_usd,
        fobTotalUsd,
        allocatedCifPen,
        allocatedDutiesPen,
        allocatedLocalCostPen: 0,
        landedCostUnitPen,
        finalLandedCostUnitPen: landedCostUnitPen,
      });
    });

    // 7. Instanciar agregado CustomsDeclarationEntity
    const declarationEntity = new CustomsDeclarationEntity({
      companyId,
      shipmentId: dto.shipment_id ?? null,
      duaNumber: dto.dua_number,
      customsAgencyCode: dto.customs_agency_code ?? '118',
      regimeCode: dto.regime_code ?? '10',
      dispatchMode: dto.dispatch_mode ?? '10',
      channel: dto.channel ?? 'PENDIENTE',
      transportDocNumber: dto.transport_doc_number ?? null,
      manifestNumber: dto.manifest_number ?? null,
      numerationDate,
      fobValueUsd: dto.fob_value_usd,
      freightValueUsd: dto.freight_value_usd,
      insuranceValueUsd: taxResult.insuranceUsd,
      cifValueUsd: taxResult.cifUsd,
      exchangeRate: dto.exchange_rate,
      cifValuePen: taxResult.cifPen,
      adValoremRate: dto.ad_valorem_rate,
      adValoremAmountPen: taxResult.adValoremPen,
      igvRate: taxResult.igvRate,
      ipmRate: taxResult.ipmRate,
      igvIpmAmountPen: Number((taxResult.igvPen + taxResult.ipmPen).toFixed(2)),
      perceptionRate: taxResult.perceptionRate,
      perceptionAmountPen: taxResult.perceptionPen,
      totalCustomsTaxesPen: taxResult.totalPayableToSunatPen,
      status: 'LIQUIDADO',
      items: customsItems,
    });

    // 8. Persistir declaración e ítems en la base de datos
    const savedDeclaration = await this.customsRepository.saveDeclarationWithItemsAndKardex(
      declarationEntity,
      customsItems,
      [],
    );

    // 9. Generar liquidaciones de cobranza con CDA (Cuotas 0010 y 0026)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15); // 15 días calendario de plazo normativo

    const settlementsToCreate: CreateSettlementData[] = taxResult.settlements.map((s) => ({
      declarationId: savedDeclaration.id!,
      settlementType: s.type,
      settlementNumber: s.cdaNumber,
      taxCode: s.typeCode,
      amountUsd: s.amountUsd,
      amountPen: s.amountPen,
      cdaNumber: s.cdaNumber,
      dueDate,
    }));

    const savedSettlements = await this.settlementRepository.createSettlements(settlementsToCreate);

    // 10. Si está asociado a un expediente, actualizar estado y registrar hito
    if (dto.shipment_id) {
      await this.shipmentRepository.updateShipmentStatus(
        dto.shipment_id,
        companyId,
        ShipmentStatus.EN_DESPACHO,
      );

      await this.shipmentRepository.addEvent({
        shipmentId: dto.shipment_id,
        eventType: 'NUMERACION',
        eventTimestamp: numerationDate,
        registeredBy: 'AGENTE_ADUANAS',
        referenceCode: dto.dua_number,
        eventValue: `Canal: ${dto.channel ?? 'PENDIENTE'} | CDA: ${taxResult.settlements[0]?.cdaNumber ?? 'N/A'}`,
      });
    }

    return {
      declaration: savedDeclaration,
      taxBreakdown: {
        isInsuranceTppsApplied: taxResult.isInsuranceTppsApplied,
        tppsInsuranceRateUsed: taxResult.tppsInsuranceRateUsed,
        cifUsd: taxResult.cifUsd,
        cifPen: taxResult.cifPen,
        adValoremPen: taxResult.adValoremPen,
        igvPen: taxResult.igvPen,
        ipmPen: taxResult.ipmPen,
        perceptionPen: taxResult.perceptionPen,
        totalPayableToSunatPen: taxResult.totalPayableToSunatPen,
      },
      settlements: savedSettlements,
    };
  }
}
