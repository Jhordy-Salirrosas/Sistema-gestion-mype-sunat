import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateExpenseDto, SetExpenseDistributionsDto } from '../../application/dto/createExpenseDto';
import { PayExpenseDto } from '../../application/dto/payExpenseDto';
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

  @Get(':id/distributions')
  distributions(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.distributions(companyId, id);
  }

  /** Reemplaza la distribución mientras el gasto no tenga asiento. */
  @Put(':id/distributions')
  @HttpCode(HttpStatus.OK)
  setDistributions(
    @Param('id') id: string,
    @Body() dto: SetExpenseDistributionsDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.setDistributions(companyId, id, dto.items ?? []);
  }

  /** Reintenta el asiento de un gasto que quedó sin contabilizar. */
  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  post(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.post(companyId, id);
  }

  @Post(':id/annul')
  @HttpCode(HttpStatus.OK)
  annul(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.expenses.annul(companyId, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@Param('id') id: string, @Body() dto: PayExpenseDto, @CurrentCompany() companyId?: string) {
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
