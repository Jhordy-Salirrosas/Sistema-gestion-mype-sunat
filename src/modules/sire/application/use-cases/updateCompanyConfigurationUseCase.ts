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
    if (Object.keys(changes).length === 0) {
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
      changes.businessName = this.requiredText(
        dto.businessName,
        'El nombre de la empresa no puede estar vacío.',
      );
    }

    if (dto.tradeName !== undefined) {
      changes.tradeName = this.requiredText(
        dto.tradeName,
        'El nombre comercial no puede estar vacío.',
      );
    }

    if (dto.direccion !== undefined) {
      changes.direccion = this.requiredText(
        dto.direccion,
        'La dirección no puede estar vacía.',
      );
    }

    if (dto.estado !== undefined) {
      changes.estado = this.requiredText(
        dto.estado,
        'El estado del contribuyente no puede estar vacío.',
      ).toUpperCase();
    }

    if (dto.condicion !== undefined) {
      changes.condicion = this.requiredText(
        dto.condicion,
        'La condición del domicilio no puede estar vacía.',
      ).toUpperCase();
    }

    if (dto.ubigeo !== undefined) {
      const ubigeo = this.requiredText(
        dto.ubigeo,
        'El ubigeo no puede estar vacío.',
      );
      if (!/^\d{6}$/.test(ubigeo)) {
        throw new BadRequestException(
          'El ubigeo debe tener exactamente 6 dígitos.',
        );
      }
      changes.ubigeo = ubigeo;
    }

    if (dto.esAgenteRetencion !== undefined) {
      changes.esAgenteRetencion = dto.esAgenteRetencion;
    }

    if (dto.series !== undefined) {
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
