import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RegisterDuaDto } from '../dto/registerDuaDto';
import { DuaNumberVO } from '../../domain/value-objects/duaNumberVo';
import { HsCodeVO } from '../../domain/value-objects/hsCodeVo';
import { CalculateCifRule } from '../../domain/rules/calculateCifRule';
import { CalculateCustomsTaxesRule } from '../../domain/rules/calculateCustomsTaxesRule';
import { CustomsDeclarationEntity } from '../../domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../domain/entities/customsItemEntity';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
} from '../../domain/ports/customsRepositoryPort';

export interface RegisteredDuaResponse {
  id: string;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  numeration_date: Date;
  cif_value_usd: number;
  cif_value_pen: number;
  total_customs_taxes_pen: number;
  status: string;
  items_count: number;
  created_at: Date;
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

    if (Math.abs(roundedItemsFob - roundedHeaderFob) > 0.05) {
      throw new BadRequestException(
        `El valor FOB total de la cabecera ($${roundedHeaderFob}) no coincide con la suma de los ítems ($${roundedItemsFob})`,
      );
    }

    // 4. Calcular CIF y tributos usando reglas puras de dominio
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

    // 5. Mapear y prorratear ítems de la DAM (desacoplado de Kardex)
    const customsItems: CustomsItemEntity[] = [];

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

    // 7. Persistir atómicamente cabecera y series (Kardex permanece intacto)
    const savedDeclaration = await this.customsRepository.saveDeclarationWithItemsAndKardex(
      declarationEntity,
      customsItems,
      [],
    );

    // 8. Construir respuesta formal
    return {
      id: savedDeclaration.id ?? '',
      dua_number: savedDeclaration.duaNumber,
      customs_agency_code: savedDeclaration.customsAgencyCode,
      regime_code: savedDeclaration.regimeCode,
      numeration_date: savedDeclaration.numerationDate,
      cif_value_usd: savedDeclaration.cifValueUsd,
      cif_value_pen: savedDeclaration.cifValuePen,
      total_customs_taxes_pen: savedDeclaration.totalCustomsTaxesPen,
      status: savedDeclaration.status,
      items_count: savedDeclaration.items.length,
      created_at: savedDeclaration.createdAt ?? new Date(),
    };
  }
}
