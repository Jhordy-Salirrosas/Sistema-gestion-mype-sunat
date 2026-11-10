import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateExpenseDto } from '../../application/dto/createExpenseDto';
import { ExpensesService } from '../../application/services/expensesService';

@Controller('api/v1/expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.list(companyId);
  }

  @Get(':id/payments')
  listPayments(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.listPayments(companyId, id);
  }

  @Post(':id/annul')
  @HttpCode(HttpStatus.OK)
  annul(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.annul(companyId, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@Param('id') id: string, @Body() dto: { amount?: number; paymentMethod?: string; bankName?: string }, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.pay(companyId, id, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateExpenseDto, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.create(companyId, dto);
  }
}
