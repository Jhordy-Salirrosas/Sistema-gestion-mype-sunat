import { Injectable } from '@nestjs/common';
import { CalculateDuaDto } from '../dto/calculateDuaDto';
import { CalculateCifRule } from '../../domain/rules/calculateCifRule';
import { CalculateCustomsTaxesRule } from '../../domain/rules/calculateCustomsTaxesRule';

export interface CalculatedDuaResponse {
  cif_value_usd: number;
  cif_value_pen: number;
  ad_valorem_amount_pen: number;
  igv_ipm_amount_pen: number;
  perception_amount_pen: number;
  total_customs_taxes_pen: number;
}

@Injectable()
export class CalculateDuaUseCase {
  execute(dto: CalculateDuaDto): CalculatedDuaResponse {
    // 1. Aplicar regla pura de cálculo CIF
    const cif = CalculateCifRule.execute({
      fobUsd: dto.fob_value_usd,
      freightUsd: dto.freight_value_usd,
      insuranceUsd: dto.insurance_value_usd,
      exchangeRate: dto.exchange_rate,
    });

    // 2. Aplicar regla pura de cálculo de tributos aduaneros
    const taxes = CalculateCustomsTaxesRule.execute({
      cifPen: cif.cifPen,
      adValoremRate: dto.ad_valorem_rate,
      perceptionRate: dto.perception_rate,
    });

    return {
      cif_value_usd: cif.cifUsd,
      cif_value_pen: cif.cifPen,
      ad_valorem_amount_pen: taxes.adValoremAmountPen,
      igv_ipm_amount_pen: taxes.igvIpmAmountPen,
      perception_amount_pen: taxes.perceptionAmountPen,
      total_customs_taxes_pen: taxes.totalCustomsTaxesPen,
    };
  }
}
