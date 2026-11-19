import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import {
  UpdateCompanyConfigurationDto,
  type CompanyConfigurationResponse,
  type CompanyListItem,
} from '../../application/dto/companyConfigurationDto';
import { GetCompanyConfigurationUseCase } from '../../application/use-cases/getCompanyConfigurationUseCase';
import { ListCompaniesUseCase } from '../../application/use-cases/listCompaniesUseCase';
import { UpdateCompanyConfigurationUseCase } from '../../application/use-cases/updateCompanyConfigurationUseCase';
import { resolveSireCompanyId } from '../../application/sireAccess';

/**
 * Variables globales de la empresa y selector Multi-RUC.
 *
 * Un ADMIN puede consultar o editar otra empresa enviando `companyId`; los
 * demás roles quedan acotados a la empresa de su token. El listado de empresas
 * está reservado al ADMIN.
 */
@Controller('api/v1/empresa')
@UseGuards(AuthGuard, RolesGuard)
export class CompanyConfigurationController {
  constructor(
    private readonly getUseCase: GetCompanyConfigurationUseCase,
    private readonly updateUseCase: UpdateCompanyConfigurationUseCase,
    private readonly listUseCase: ListCompaniesUseCase,
  ) {}

  @Get('listar')
  @Roles('ADMIN')
  async listar(): Promise<CompanyListItem[]> {
    return this.listUseCase.execute();
  }

  @Get('configuracion')
  async obtener(
    @CurrentUser() user?: TokenPayload,
    @Query('companyId') companyId?: string,
  ): Promise<CompanyConfigurationResponse> {
    return this.getUseCase.execute(resolveSireCompanyId(user, companyId));
  }

  @Put('configuracion')
  async actualizar(
    @Body() dto: UpdateCompanyConfigurationDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<CompanyConfigurationResponse> {
    return this.updateUseCase.execute(
      resolveSireCompanyId(user, dto.companyId),
      dto,
    );
  }
}
