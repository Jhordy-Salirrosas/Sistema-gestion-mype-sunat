import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UnauthorizedException,
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
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.settlementRepository.findPendingSettlementsByCompany(companyId);
  }

  @Get('declaration/:declarationId')
  @HttpCode(HttpStatus.OK)
  async getSettlementsByDeclaration(
    @Param('declarationId') declarationId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.settlementRepository.findSettlementsByDeclarationId(declarationId, companyId);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async paySettlement(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: PaySettlementDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.paySettlementUseCase.execute(id, dto, companyId);
  }
}
