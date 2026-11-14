import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  SireConfiguracionEstadoResponse,
  SireConfiguracionRequestDto,
} from '../dto/sireConfigurationDto';
import {
  SIRE_CONFIGURATION_REPOSITORY_PORT,
  type ISireConfigurationRepositoryPort,
} from '../../domain/ports/sireConfigurationRepositoryPort';

/**
 * Guarda las credenciales SIRE/SUNAT de la empresa.
 *
 * El texto plano que llega del controlador se cifra en el adaptador: aquí solo
 * se decide QUÉ se guarda y con qué formato (trim en los identificadores que
 * no admiten espacios, sin trim en las contraseñas).
 */
@Injectable()
export class GuardarConfiguracionSireUseCase {
  constructor(
    @Inject(SIRE_CONFIGURATION_REPOSITORY_PORT)
    private readonly repository: ISireConfigurationRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    dto: SireConfiguracionRequestDto,
  ): Promise<SireConfiguracionEstadoResponse> {
    if (!this.hasAnyCredential(dto)) {
      throw new BadRequestException(
        'No se recibió ninguna credencial SIRE para guardar.',
      );
    }

    await this.repository.save(companyId, {
      clientId: this.trim(dto.clientId),
      clientSecret: dto.clientSecret,
      solUser: this.trim(dto.solUser),
      solPassword: dto.solPassword,
    });

    return { configured: await this.repository.isConfigured(companyId) };
  }

  private hasAnyCredential(dto: SireConfiguracionRequestDto): boolean {
    return (
      dto.clientId !== undefined ||
      dto.clientSecret !== undefined ||
      dto.solUser !== undefined ||
      dto.solPassword !== undefined
    );
  }

  /**
   * Los identificadores no admiten espacios: un `clientId` o un `solUser` con
   * espacios fallaría contra SUNAT con un error difícil de interpretar.
   */
  private trim(value: string | undefined): string | undefined {
    return value === undefined ? undefined : value.trim();
  }
}
