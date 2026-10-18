import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CalculateDuaDto } from '../../application/dto/calculateDuaDto';
import { RegisterDuaDto } from '../../application/dto/registerDuaDto';
import { RegisterDuaWizardDto } from '../../application/dto/registerDuaWizardDto';
import {
  CalculateDuaUseCase,
  type CalculatedDuaResponse,
} from '../../application/use-cases/calculateDuaUseCase';
import {
  RegisterDuaUseCase,
  type RegisteredDuaResponse,
} from '../../application/use-cases/registerDuaUseCase';
import { RegisterDuaWizardUseCase } from '../../application/use-cases/registerDuaWizardUseCase';
import {
  GetCustomsDeclarationByIdUseCase,
  type CustomsDeclarationDetailResponse,
} from '../../application/use-cases/getCustomsDeclarationByIdUseCase';
import { ListCustomsDeclarationsUseCase } from '../../application/use-cases/listCustomsDeclarationsUseCase';
import { ListKardexMovementsUseCase } from '../../application/use-cases/listKardexMovementsUseCase';
import type {
  CustomsDeclarationSummary,
  KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';

@Controller('api/v1/customs')
export class CustomsController {
  constructor(
    private readonly calculateDuaUseCase: CalculateDuaUseCase,
    private readonly registerDuaUseCase: RegisterDuaUseCase,
    private readonly getCustomsDeclarationByIdUseCase: GetCustomsDeclarationByIdUseCase,
    private readonly listCustomsDeclarationsUseCase: ListCustomsDeclarationsUseCase,
    private readonly listKardexMovementsUseCase: ListKardexMovementsUseCase,
    @Optional() private readonly registerDuaWizardUseCase?: RegisterDuaWizardUseCase,
  ) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculateLiquidation(@Body() dto: CalculateDuaDto): CalculatedDuaResponse {
    return this.calculateDuaUseCase.execute(dto);
  }

  @Post('declarations/wizard')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerDeclarationWizard(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: RegisterDuaWizardDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    if (!this.registerDuaWizardUseCase) {
      throw new Error('RegisterDuaWizardUseCase no está inyectado');
    }
    return this.registerDuaWizardUseCase.execute(dto, resolvedCompanyId);
  }

  @Post('declarations')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerDeclaration(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: RegisterDuaDto,
  ): Promise<RegisteredDuaResponse> {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.registerDuaUseCase.execute(dto, resolvedCompanyId);
  }

  @Get('declarations/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDeclarationById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ): Promise<CustomsDeclarationDetailResponse> {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.getCustomsDeclarationByIdUseCase.execute(id, resolvedCompanyId);
  }

  @Get('declarations')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listDeclarations(
    @CurrentCompany() companyId: string | undefined,
  ): Promise<CustomsDeclarationSummary[]> {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.listCustomsDeclarationsUseCase.execute(resolvedCompanyId);
  }

  @Get('kardex')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listKardexMovements(
    @CurrentCompany() companyId: string | undefined,
  ): Promise<KardexMovementRecord[]> {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.listKardexMovementsUseCase.execute(resolvedCompanyId);
  }
}
