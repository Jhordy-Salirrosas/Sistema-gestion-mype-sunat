import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateQuoteDto, UpdateQuoteStatusDto } from '../../application/dto/createQuoteDto';
import { SalesQuotesService } from '../../application/services/salesQuotesService';

@Controller('api/v1/sales/quotes')
@UseGuards(AuthGuard)
export class SalesQuotesController {
  constructor(private readonly quotes: SalesQuotesService) {}
  @Get() list(@CurrentCompany() companyId: string, @Query('kind') kind?: string) { return this.quotes.list(companyId, kind === 'PEDIDO' ? 'PEDIDO' : 'COTIZACION'); }
  @Get(':id') get(@CurrentCompany() companyId: string, @Param('id') id: string) { return this.quotes.get(companyId, id); }
  @Post() create(@CurrentCompany() companyId: string, @Body() dto: CreateQuoteDto) { return this.quotes.create(companyId, dto); }
  @Patch(':id/status') status(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) { return this.quotes.updateStatus(companyId, id, dto.status); }
}
