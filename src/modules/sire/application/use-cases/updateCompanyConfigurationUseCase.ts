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
 * mayÃºsculas y se deduplican porque SUNAT las distingue por ese formato.
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
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'No se recibiÃ³ ningÃºn dato de la empresa para actualizar.',
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

    if (dto.businessName != null) {
      changes.businessName = this.requiredText(
        dto.businessName,
        'El nombre de la empresa no puede estar vacÃ­o.',
      );
    }

    if (dto.tradeName != null) {
      changes.tradeName = this.requiredText(
        dto.tradeName,
        'El nombre comercial no puede estar vacÃ­o.',
      );
    }

    if (dto.direccion != null) {
      changes.direccion = this.requiredText(
        dto.direccion,
        'La direcciÃ³n no puede estar vacÃ­a.',
      );
    }

    if (dto.estado != null) {
      changes.estado = this.requiredText(
        dto.estado,
        'El estado del contribuyente no puede estar vacÃ­o.',
      ).toUpperCase();
    }

    if (dto.condicion != null) {
      changes.condicion = this.requiredText(
        dto.condicion,
        'La condiciÃ³n del domicilio no puede estar vacÃ­a.',
      ).toUpperCase();
    }

    if (dto.ubigeo != null) {
      const ubigeo = this.requiredText(
        dto.ubigeo,
        'El ubigeo no puede estar vacÃ­o.',
      );
      if (!/^\d{6}$/.test(ubigeo)) {
        throw new BadRequestException(
          'El ubigeo debe tener exactamente 6 dÃ­gitos.',
        );
      }
      changes.ubigeo = ubigeo;
    }

    if (dto.esAgenteRetencion != null) {
      changes.esAgenteRetencion = dto.esAgenteRetencion;
    }

    if (dto.series != null) {
      changes.series = this.normalizeSeries(dto.series);
    }

    return changes;
  }

  private requiredText(value: string, message: string): string {
    const text = value.trim();
    if (text.length === 0) {
      throw new BadRequestException(message);
    }
    return text;
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
