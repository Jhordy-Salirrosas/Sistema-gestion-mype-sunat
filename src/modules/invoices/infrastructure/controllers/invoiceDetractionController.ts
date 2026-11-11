import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InvoiceDetractionService } from '../../application/services/invoiceDetractionService';

@Controller('api/v1/invoices/detractions')
@UseGuards(AuthGuard)
export class InvoiceDetractionController {
  constructor(private readonly detractions: InvoiceDetractionService) {}

  @Get()
  list(@CurrentCompany() companyId: string | undefined, @Query('period') period: string) {
    if (!companyId) throw new BadRequestException('Identificador de empresa requerido.');
    return this.detractions.list(companyId, period);
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  deposit(@Param('id') id: string, @Body() dto: { amount?: number; date?: string; constancia?: string }, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new BadRequestException('Identificador de empresa requerido.');
    return this.detractions.registerDeposit(companyId, id, dto);
  }
}
