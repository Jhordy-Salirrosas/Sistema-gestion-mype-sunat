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
import { PaySettlementDto } from '../../application/dto';
import { PaySettlementUseCase } from '../../application/use-cases';
import {
  CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
  type ICustomsSettlementRepositoryPort,
} from '../../domain/ports/customsSettlementRepositoryPort';

@Controller('api/v1/customs/settlements')
@UseGuards(AuthGuard)
export class CustomsSettlementController {
  constructor(
    private readonly paySettlementUseCase: PaySettlementUseCase,
    @Inject(CUSTOMS_SETTLEMENT_REPOSITORY_PORT)
    private readonly settlementRepository: ICustomsSettlementRepositoryPort,
  ) {}

  @Get('pending')
  @HttpCode(HttpStatus.OK)
  async getPendingSettlements(@CurrentCompany() companyId: string | undefined) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.settlementRepository.findPendingSettlementsByCompany(resolvedCompanyId);
  }

  @Get('declaration/:declarationId')
  @HttpCode(HttpStatus.OK)
  async getSettlementsByDeclaration(@Param('declarationId') declarationId: string) {
    return this.settlementRepository.findSettlementsByDeclarationId(declarationId);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async paySettlement(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: PaySettlementDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.paySettlementUseCase.execute(id, dto, resolvedCompanyId);
  }
}
