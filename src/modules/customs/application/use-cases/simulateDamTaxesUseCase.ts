import { Injectable } from '@nestjs/common';
import { SimulateDamTaxesDto } from '../dto/simulateDamTaxesDto';
import {
  TaxLiquidationEngine,
  TaxLiquidationResult,
} from '../../domain/rules/TaxLiquidationEngine';
import {
  VuceComplianceEngine,
  VuceRestrictionCheck,
} from '../../domain/rules/VuceComplianceEngine';

export interface SimulateDamTaxesResult {
  liquidation: TaxLiquidationResult;
  vuceWarnings: VuceRestrictionCheck[];
  hasRestrictedGoods: boolean;
}

@Injectable()
export class SimulateDamTaxesUseCase {
  async execute(dto: SimulateDamTaxesDto): Promise<SimulateDamTaxesResult> {
    const primaryHsCode = dto.items && dto.items.length > 0 ? dto.items[0].hsCode : undefined;

    // 1. Simulación tributaria mediante el motor arancelario de dominio
    const liquidation = TaxLiquidationEngine.calculate({
      fobUsd: dto.fobValueUsd,
      freightUsd: dto.freightValueUsd,
      insuranceUsd: dto.insuranceValueUsd,
      hsCode: primaryHsCode,
      exchangeRate: dto.exchangeRate,
      adValoremRate: dto.adValoremRate ?? 0,
      perceptionRate: dto.perceptionRate ?? 3.5,
    });

    // 2. Verificación de restricciones VUCE
    const vuceWarnings = dto.items
      ? VuceComplianceEngine.verifyBatch(
          dto.items.map((it) => ({
            hsCode: it.hsCode,
            commercialDescription: it.commercialDescription,
          })),
        )
      : [];

    return {
      liquidation,
      vuceWarnings,
      hasRestrictedGoods: vuceWarnings.length > 0,
    };
  }
}

