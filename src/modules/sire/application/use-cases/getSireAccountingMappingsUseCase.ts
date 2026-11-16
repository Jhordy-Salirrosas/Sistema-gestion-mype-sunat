import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SireAccountingMappingResponse } from '../dto/sireAccountingMappingDto';
import {
  SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT,
  type ISireAccountingMappingRepositoryPort,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';

/**
 * Consulta el mapeo contable SIRE de la empresa autenticada.
 */
@Injectable()
export class GetSireAccountingMappingsUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly repository: ISireAccountingMappingRepositoryPort,
  ) {}

  async execute(companyId: string): Promise<SireAccountingMappingResponse[]> {
    const mappings = await this.repository.findAll(companyId);
    if (!mappings) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return mappings;
  }
}
