import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { Roles } from '../../../../common/decorators';
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/infrastructure/decorators/currentUserDecorator';
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

  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
  @Post(':id')
  @HttpCode(HttpStatus.OK)
  deposit(@Param('id') id: string, @Body() dto: { amount?: number; date?: string; constancia?: string }, @CurrentCompany() companyId?: string, @CurrentUser() user?: { sub: string }) {
    if (!companyId) throw new BadRequestException('Identificador de empresa requerido.');
    if (!user?.sub) throw new BadRequestException('Usuario autenticado requerido.');
    return this.detractions.registerDeposit(companyId, id, dto, user.sub);
  }
}
