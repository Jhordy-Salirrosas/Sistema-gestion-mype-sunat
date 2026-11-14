import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import type {
  SireConfiguracionEstadoResponse,
  SireConfiguracionRequestDto,
} from '../../application/dto/sireConfigurationDto';
import { ConsultarEstadoConfiguracionSireUseCase } from '../../application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { GuardarConfiguracionSireUseCase } from '../../application/use-cases/guardarConfiguracionSireUseCase';

/**
 * Configuración SIRE/SUNAT de la empresa.
 *
 * Las credenciales se guardan una sola vez y cifradas: el frontend no las
 * vuelve a enviar y el backend las resuelve desde la base de datos cuando un
 * trabajo necesita hablar con SUNAT.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard)
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
    return this.guardarUseCase.execute(this.requireCompany(user), dto);
  }

  /**
   * Estado de la configuración SIRE de la empresa.
   */
  @Get('configuracion/status')
  async estado(
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireConfiguracionEstadoResponse> {
    return this.consultarEstadoUseCase.execute(this.requireCompany(user));
  }

  /**
   * Empresa de la sesión.
   *
   * Las credenciales siempre pertenecen a la empresa autenticada: nunca a la
   * que el cliente indique en el cuerpo de la petición.
   */
  private requireCompany(user?: TokenPayload): string {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return user.companyId;
  }
}
