import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import {
  AddLocalExpenseDto,
  CalculateLandedCostDto,
  ApplyLandedCostToKardexDto,
} from '../../application/dto';
import {
  AddLocalExpenseUseCase,
  CalculateLandedCostUseCase,
  ApplyLandedCostToKardexUseCase,
} from '../../application/use-cases';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';

@Controller('api/v1/customs/landed-cost')
@UseGuards(AuthGuard)
export class LandedCostController {
  constructor(
    private readonly addLocalExpenseUseCase: AddLocalExpenseUseCase,
    private readonly calculateLandedCostUseCase: CalculateLandedCostUseCase,
    private readonly applyLandedCostToKardexUseCase: ApplyLandedCostToKardexUseCase,
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
  ) {}

  @Post('expenses')
  @HttpCode(HttpStatus.CREATED)
  async addExpense(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddLocalExpenseDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.addLocalExpenseUseCase.execute(dto, resolvedCompanyId);
  }

  @Get('expenses/:shipmentId')
  @HttpCode(HttpStatus.OK)
  async getExpenses(@Param('shipmentId') shipmentId: string) {
    return this.landedCostRepository.findLocalExpensesByShipmentId(shipmentId);
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateLandedCost(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CalculateLandedCostDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.calculateLandedCostUseCase.execute(dto, resolvedCompanyId);
  }

  @Post('apply-kardex')
  @HttpCode(HttpStatus.CREATED)
  async applyToKardex(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: ApplyLandedCostToKardexDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.applyLandedCostToKardexUseCase.execute(dto, resolvedCompanyId);
  }

  @Get('sheet/:shipmentId')
  @HttpCode(HttpStatus.OK)
  async getSheet(@Param('shipmentId') shipmentId: string) {
    return this.landedCostRepository.findLandedCostSheetByShipmentId(shipmentId);
  }
}
