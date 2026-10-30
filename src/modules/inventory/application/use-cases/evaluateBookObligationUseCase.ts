import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_OBLIGATION_REPOSITORY_PORT,
  type IInventoryObligationRepositoryPort,
} from '../../domain/ports/IInventoryObligationRepositoryPort';
import { EvaluateBookObligationDto } from '../dto/evaluateBookObligationDto';

@Injectable()
export class EvaluateBookObligationUseCase {
  constructor(
    @Inject(INVENTORY_OBLIGATION_REPOSITORY_PORT)
    private readonly obligationRepository: IInventoryObligationRepositoryPort,
  ) {}

  async execute(dto: EvaluateBookObligationDto, companyId: string) {
    if (!companyId) throw new BadRequestException('company_id requerido.');

    const { fiscal_year, annual_revenue_uit, tax_regime } = dto;
    const regime = (tax_regime || '').toUpperCase().trim();

    let ple12_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
    let ple13_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
    let legalBasisNotes: string;

    if (regime === 'RER') {
      ple12_1Status = 'EXCEPTUADO';
      ple13_1Status = 'EXCEPTUADO';
      legalBasisNotes =
        'El Régimen Especial del Impuesto a la Renta (RER) se encuentra legalmente exonerado de llevar registros de inventario permanente (Art. 118 LIR).';
    } else if (annual_revenue_uit <= 500) {
      ple12_1Status = 'EXCEPTUADO';
      ple13_1Status = 'EXCEPTUADO';
      legalBasisNotes =
        'Ingresos brutos anuales menores o iguales a 500 UIT. Solo obligado a practicar inventario físico anual (Art. 35 inc. c Reglamento LIR).';
    } else if (annual_revenue_uit > 500 && annual_revenue_uit <= 1500) {
      ple12_1Status = 'OBLIGATORIO';
      ple13_1Status = 'VOLUNTARIO';
      legalBasisNotes =
        'Ingresos anuales entre 500 y 1,500 UIT: Obligado a llevar Registro de Inventario Permanente en Unidades Físicas (PLE 12.1). Registro Valorizado (13.1) es voluntario.';
    } else {
      // > 1500 UIT
      ple12_1Status = 'EXCEPTUADO';
      ple13_1Status = 'OBLIGATORIO';
      legalBasisNotes =
        'Ingresos superiores a 1,500 UIT: Obligado a llevar Registro de Inventario Permanente Valorizado (PLE 13.1). Queda legalmente EXCEPTUADO de llevar el libro 12.1 según RS 239-2008/SUNAT.';
    }

    const saved = await this.obligationRepository.saveDecision({
      companyId,
      fiscalYear: fiscal_year,
      annualRevenueUit: annual_revenue_uit,
      taxRegime: regime,
      ple12_1Status,
      ple13_1Status,
      legalBasisNotes,
    });

    return saved;
  }
}

