import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/currentUserDecorator';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { PaymentSchedulesService } from '../../application/services/paymentSchedulesService';
import { CreatePaymentScheduleDto, UpdatePurchaseDueDateDto } from '../../application/dto/paymentScheduleDto';

@Controller('api/v1/payment-schedules')
@UseGuards(AuthGuard)
export class PaymentSchedulesController {
  constructor(private readonly schedules: PaymentSchedulesService) {}
  @Get() list(@CurrentCompany() companyId: string) { return this.schedules.list(companyId); }
  @Post() @HttpCode(HttpStatus.CREATED) create(@CurrentCompany() companyId: string, @Body() dto: CreatePaymentScheduleDto, @CurrentUser() user: TokenPayload) { return this.schedules.create(companyId, dto, user.sub); }
  @Delete(':id') @HttpCode(HttpStatus.OK) cancel(@CurrentCompany() companyId: string, @Param('id') id: string) { return this.schedules.cancel(companyId, id); }
}

@Controller('api/v1/purchases')
@UseGuards(AuthGuard)
export class PurchaseDueDateController {
  constructor(private readonly schedules: PaymentSchedulesService) {}
  @Patch(':id/due-date') @HttpCode(HttpStatus.OK) update(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() dto: UpdatePurchaseDueDateDto) { return this.schedules.updateDueDate(companyId, id, dto.dueDate); }
}
