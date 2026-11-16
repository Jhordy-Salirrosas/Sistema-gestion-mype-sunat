import {
  Body,
  Controller,
  Get,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import type {
  CompanyConfigurationResponse,
  UpdateCompanyConfigurationDto,
} from '../../application/dto/companyConfigurationDto';
import { GetCompanyConfigurationUseCase } from '../../application/use-cases/getCompanyConfigurationUseCase';
import { UpdateCompanyConfigurationUseCase } from '../../application/use-cases/updateCompanyConfigurationUseCase';

/**
 * Variables globales de la empresa autenticada.
 *
 * El RUC siempre sale de la empresa de la sesión: el cliente no puede leer ni
 * modificar la configuración de otra empresa.
 */
@Controller('api/v1/empresa')
@UseGuards(AuthGuard)
export class CompanyConfigurationController {
  constructor(
    private readonly getUseCase: GetCompanyConfigurationUseCase,
    private readonly updateUseCase: UpdateCompanyConfigurationUseCase,
  ) {}

  @Get('configuracion')
  async obtener(
    @CurrentUser() user?: TokenPayload,
  ): Promise<CompanyConfigurationResponse> {
    return this.getUseCase.execute(this.requireCompany(user));
  }

  @Put('configuracion')
  async actualizar(
    @Body() dto: UpdateCompanyConfigurationDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<CompanyConfigurationResponse> {
    return this.updateUseCase.execute(this.requireCompany(user), dto);
  }

  private requireCompany(user?: TokenPayload): string {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return user.companyId;
  }
}
