import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CustomsAccountingService } from '../../application/services/customsAccountingService';

@Controller('api/v1/customs/accounting')
@UseGuards(AuthGuard)
export class CustomsAccountingController {
  constructor(private readonly accountingService: CustomsAccountingService) {}

  @Get('rules')
  async getMappingRules(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.accountingService.getMappingRules(companyId);
  }

  @Put('rules')
  async updateMappingRules(
    @Body() body: { rules: Array<{ roleCode: string; accountCode: string }> },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.accountingService.upsertMappingRules(companyId, body.rules || []);
  }

  @Get('summary/:shipmentId')
  async getAccountingSummary(
    @Param('shipmentId') shipmentId: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.accountingService.getAccountingSummary(companyId, shipmentId);
  }

  @Post('sync/:shipmentId')
  @HttpCode(HttpStatus.OK)
  async syncToGeneralLedger(
    @Param('shipmentId') shipmentId: string,
    @Body() body: { responsible?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.accountingService.syncToGeneralLedger(companyId, shipmentId, body?.responsible);
  }
}
