import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CUSTOMS_REPOSITORY_PORT } from '../../domain/ports/customsRepositoryPort';
import type { ICustomsRepositoryPort } from '../../domain/ports/customsRepositoryPort';

export interface CustomsDeclarationDetailResponse {
  id?: string;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  numeration_date: Date;
  fob_value_usd: number;
  freight_value_usd: number;
  insurance_value_usd: number;
  cif_value_usd: number;
  exchange_rate: number;
  cif_value_pen: number;
  ad_valorem_rate: number;
  ad_valorem_amount_pen: number;
  igv_rate: number;
  ipm_rate: number;
  igv_ipm_amount_pen: number;
  perception_rate: number;
  perception_amount_pen: number;
  total_customs_taxes_pen: number;
  status: string;
  items: {
    id?: string;
    item_order: number;
    item_code?: string;
    hs_code: string;
    commercial_description: string;
    quantity: number;
    unit_code: string;
    fob_unit_usd: number;
    fob_total_usd: number;
    allocated_cif_pen: number;
    allocated_duties_pen: number;
    landed_cost_unit_pen: number;
  }[];
  created_at?: Date;
}

@Injectable()
export class GetCustomsDeclarationByIdUseCase {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(id: string, companyId: string): Promise<CustomsDeclarationDetailResponse> {
    const declaration = await this.customsRepository.findDeclarationById(id, companyId);

    if (!declaration) {
      throw new NotFoundException(`Declaración aduanera con ID '${id}' no encontrada`);
    }

    return {
      id: declaration.id,
      dua_number: declaration.duaNumber,
      customs_agency_code: declaration.customsAgencyCode,
      regime_code: declaration.regimeCode,
      numeration_date: declaration.numerationDate,
      fob_value_usd: declaration.fobValueUsd,
      freight_value_usd: declaration.freightValueUsd,
      insurance_value_usd: declaration.insuranceValueUsd,
      cif_value_usd: declaration.cifValueUsd,
      exchange_rate: declaration.exchangeRate,
      cif_value_pen: declaration.cifValuePen,
      ad_valorem_rate: declaration.adValoremRate,
      ad_valorem_amount_pen: declaration.adValoremAmountPen,
      igv_rate: declaration.igvRate,
      ipm_rate: declaration.ipmRate,
      igv_ipm_amount_pen: declaration.igvIpmAmountPen,
      perception_rate: declaration.perceptionRate,
      perception_amount_pen: declaration.perceptionAmountPen,
      total_customs_taxes_pen: declaration.totalCustomsTaxesPen,
      status: declaration.status,
      items: declaration.items.map((item) => ({
        id: item.id,
        item_order: item.itemOrder,
        item_code: item.itemCode,
        hs_code: item.hsCode,
        commercial_description: item.commercialDescription,
        quantity: item.quantity,
        unit_code: item.unitCode,
        fob_unit_usd: item.fobUnitUsd,
        fob_total_usd: item.fobTotalUsd,
        allocated_cif_pen: item.allocatedCifPen,
        allocated_duties_pen: item.allocatedDutiesPen,
        landed_cost_unit_pen: item.landedCostUnitPen,
      })),
      created_at: declaration.createdAt,
    };
  }
}
