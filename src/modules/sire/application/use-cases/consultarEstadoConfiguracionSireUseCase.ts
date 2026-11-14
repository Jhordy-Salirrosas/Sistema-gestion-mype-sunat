import { Inject, Injectable } from '@nestjs/common';
import type { SireConfiguracionEstadoResponse } from '../dto/sireConfigurationDto';
import {
  SIRE_CONFIGURATION_REPOSITORY_PORT,
  type ISireConfigurationRepositoryPort,
} from '../../domain/ports/sireConfigurationRepositoryPort';

/**
 * Consulta si la empresa ya tiene credenciales SIRE configuradas.
 *
 * Es el endpoint que el frontend usa para decidir si muestra el formulario de
 * credenciales o el de consulta de períodos.
 */
@Injectable()
export class ConsultarEstadoConfiguracionSireUseCase {
  constructor(
    @Inject(SIRE_CONFIGURATION_REPOSITORY_PORT)
    private readonly repository: ISireConfigurationRepositoryPort,
  ) {}

  async execute(
    companyId: string,
  ): Promise<SireConfiguracionEstadoResponse> {
    return { configured: await this.repository.isConfigured(companyId) };
  }
}
