import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryPurchaseService } from '../../application/services/inventoryPurchaseService';
import { CreateNationalPurchaseDto } from '../../application/dto/nationalPurchaseDto';
import { PayPurchaseDto } from '../../application/dto/payPurchaseDto';
import {
  mapPurchaseRecord,
  mapPurchasesListResponse,
  requirePurchaseCompanyId,
} from '../../../purchases/application/mappers/purchaseResponseMapper';

@Controller('api/v1/inventory/purchases')
@UseGuards(AuthGuard)
export class InventoryPurchasesController {
  constructor(private readonly purchaseService: InventoryPurchaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPurchase(
    @Body() dto: CreateNationalPurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.purchaseService.createPurchase(requirePurchaseCompanyId(companyId), dto);
  }

  @Get(':id/payments')
  async listPayments(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    return this.purchaseService.listPayments(requirePurchaseCompanyId(companyId), id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payPurchase(
    @Param('id') id: string,
    @Body() dto: PayPurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.purchaseService.payPurchase(requirePurchaseCompanyId(companyId), id, dto);
  }

  @Get('payables')
  async listPayables(@CurrentCompany() companyId?: string) {
    return this.purchaseService.listPayables(requirePurchaseCompanyId(companyId));
  }

  @Get()
  async listPurchases(@CurrentCompany() companyId?: string) {
    const purchases = await this.purchaseService.listPurchases(requirePurchaseCompanyId(companyId));
    return mapPurchasesListResponse(purchases, false);
  }

  @Get(':id')
  async getPurchaseById(
    @Param('id') id: string,
    @CurrentCompany() companyId?: string,
  ) {
    const purchase = await this.purchaseService.getPurchaseById(
      requirePurchaseCompanyId(companyId),
      id,
    );
    return mapPurchaseRecord(purchase, { includeExtended: false, includeItemsCount: false });
  }
}

