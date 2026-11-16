import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CompanyConfigurationResponse } from '../dto/companyConfigurationDto';
import {
  COMPANY_CONFIGURATION_REPOSITORY_PORT,
  type ICompanyConfigurationRepositoryPort,
} from '../../domain/ports/companyConfigurationRepositoryPort';

/**
 * Consulta las variables globales de la empresa autenticada.
 */
@Injectable()
export class GetCompanyConfigurationUseCase {
  constructor(
    @Inject(COMPANY_CONFIGURATION_REPOSITORY_PORT)
    private readonly repository: ICompanyConfigurationRepositoryPort,
  ) {}

  async execute(companyId: string): Promise<CompanyConfigurationResponse> {
    const configuration = await this.repository.findByCompanyId(companyId);
    if (!configuration) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return configuration;
  }
}
