import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import type { SireConfiguracionEstadoResponse } from '../../application/dto/sireConfigurationDto';
import { SireConfiguracionRequestDto } from '../../application/dto/sireConfigurationDto';
import { ConsultarEstadoConfiguracionSireUseCase } from '../../application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { GuardarConfiguracionSireUseCase } from '../../application/use-cases/guardarConfiguracionSireUseCase';
import {
  resolveSireCompanyId,
  SIRE_CONFIG_ROLES,
} from '../../application/sireAccess';

/**
 * Configuración SIRE/SUNAT por empresa (Multi-RUC).
 *
 * Las credenciales se guardan cifradas en `SireConfiguration`. Un ADMIN puede
 * administrar cualquier empresa enviando `companyId`; los demás roles solo
 * operan sobre la empresa de su token.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...SIRE_CONFIG_ROLES)
export class SireConfigurationController {
  constructor(
    private readonly guardarUseCase: GuardarConfiguracionSireUseCase,
    private readonly consultarEstadoUseCase: ConsultarEstadoConfiguracionSireUseCase,
  ) {}

  /**
   * Guarda (o actualiza) las credenciales SIRE de la empresa.
   *
   * Los campos que no se envían se conservan tal como estaban.
   */
  @Post('configuracion')
  @HttpCode(HttpStatus.OK)
  async guardar(
    @Body() dto: SireConfiguracionRequestDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireConfiguracionEstadoResponse> {
    return this.guardarUseCase.execute(
      resolveSireCompanyId(user, dto.companyId),
      dto,
    );
  }

  /**
   * Estado de la configuración SIRE de la empresa.
   */
  @Get('configuracion/status')
  async estado(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireConfiguracionEstadoResponse> {
    return this.consultarEstadoUseCase.execute(
      resolveSireCompanyId(user, companyId),
    );
  }

}
