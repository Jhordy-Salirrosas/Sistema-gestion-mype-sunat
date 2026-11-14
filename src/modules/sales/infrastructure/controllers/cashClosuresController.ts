import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/currentUserDecorator';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { CashClosuresService } from '../../application/services/cashClosuresService';

@Controller('api/v1/sales/cash-closures')
@UseGuards(AuthGuard)
export class CashClosuresController {
  constructor(private readonly caja: CashClosuresService) {}
  @Get('summary') summary(@CurrentCompany() companyId: string, @Query('date') date: string) { return this.caja.summary(companyId, date); }
  @Get() list(@CurrentCompany() companyId: string) { return this.caja.list(companyId); }
  @Post() close(@CurrentCompany() companyId: string, @Body() dto: { date: string; countedCash: number; notes?: string }, @CurrentUser() user: TokenPayload) { return this.caja.close(companyId, { ...dto, createdBy: user.sub }); }
}
