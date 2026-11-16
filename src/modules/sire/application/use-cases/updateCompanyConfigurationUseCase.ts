import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CompanyConfigurationResponse,
  UpdateCompanyConfigurationDto,
} from '../dto/companyConfigurationDto';
import {
  COMPANY_CONFIGURATION_REPOSITORY_PORT,
  type CompanyConfigurationChanges,
  type ICompanyConfigurationRepositoryPort,
} from '../../domain/ports/companyConfigurationRepositoryPort';

/**
 * Actualiza las variables globales de la empresa autenticada.
 *
 * El RUC nunca se modifica: solo se devuelve. Las series se normalizan a
 * mayúsculas y se deduplican porque SUNAT las distingue por ese formato.
 */
@Injectable()
export class UpdateCompanyConfigurationUseCase {
  constructor(
    @Inject(COMPANY_CONFIGURATION_REPOSITORY_PORT)
    private readonly repository: ICompanyConfigurationRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    dto: UpdateCompanyConfigurationDto,
  ): Promise<CompanyConfigurationResponse> {
    const changes = this.normalize(dto);
    if (changes.businessName === undefined && changes.series === undefined) {
      throw new BadRequestException(
        'No se recibió ningún dato de la empresa para actualizar.',
      );
    }

    const updated = await this.repository.update(companyId, changes);
    if (!updated) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return updated;
  }

  private normalize(
    dto: UpdateCompanyConfigurationDto,
  ): CompanyConfigurationChanges {
    const changes: CompanyConfigurationChanges = {};

    if (dto.businessName !== undefined) {
      const businessName = dto.businessName.trim();
      if (businessName.length === 0) {
        throw new BadRequestException(
          'El nombre de la empresa no puede estar vacío.',
        );
      }
      changes.businessName = businessName;
    }

    if (dto.series !== undefined) {
      changes.series = this.normalizeSeries(dto.series);
    }

    return changes;
  }

  private normalizeSeries(series: string[]): string[] {
    return [
      ...new Set(
        series
          .map((value) => value.trim().toUpperCase())
          .filter((value) => value.length > 0),
      ),
    ];
  }
}
