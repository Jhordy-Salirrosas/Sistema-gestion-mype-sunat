import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/currentUserDecorator';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { PurchaseOrdersService } from '../../application/services/purchaseOrdersService';
import { ConvertPurchaseOrderDto, CreatePurchaseOrderDto } from '../../application/dto/purchaseOrderDto';

@Controller('api/v1/purchase-orders')
@UseGuards(AuthGuard)
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}
  @Get() list(@CurrentCompany() companyId: string) { return this.orders.list(companyId); }
  @Get(':id') get(@CurrentCompany() companyId: string, @Param('id') id: string) { return this.orders.get(companyId, id); }
  @Post() create(@CurrentCompany() companyId: string, @Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: TokenPayload) { return this.orders.create(companyId, dto, user.sub); }
  @Post(':id/approve') @HttpCode(HttpStatus.OK) approve(@CurrentCompany() companyId: string, @Param('id') id: string) { return this.orders.approve(companyId, id); }
  @Post(':id/cancel') @HttpCode(HttpStatus.OK) cancel(@CurrentCompany() companyId: string, @Param('id') id: string) { return this.orders.cancel(companyId, id); }
  @Post(':id/convert') @HttpCode(HttpStatus.CREATED) convert(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() dto: ConvertPurchaseOrderDto) { return this.orders.convert(companyId, id, dto); }
}
