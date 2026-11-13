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
import { PurchasesService } from '../../application/services/purchasesService';
import { CreatePurchaseDto } from '../../application/dto/createPurchaseDto';
import { PayPurchaseDto } from '../../application/dto/payPurchaseDto';
import { CreateManualPayableDto } from '../../application/dto/createManualPayableDto';
import { ReceivePurchaseDto } from '../../application/dto/receivePurchaseDto';
import {
  mapPurchaseRecord,
  mapPurchasesListResponse,
  requirePurchaseCompanyId,
} from '../../application/mappers/purchaseResponseMapper';

/**
 * Controlador del Módulo Autónomo de Compras (Fase 1).
 * Rutas bajo /api/v1/purchases para desacoplar compras de inventario.
 */
@Controller('api/v1/purchases')
@UseGuards(AuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPurchase(
    @Body() dto: CreatePurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.purchasesService.createPurchase(requirePurchaseCompanyId(companyId), dto);
  }

  @Get(':id/payments')
  async listPayments(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    return this.purchasesService.listPayments(requirePurchaseCompanyId(companyId), id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payPurchase(
    @Param('id') id: string,
    @Body() dto: PayPurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.purchasesService.payPurchase(requirePurchaseCompanyId(companyId), id, dto);
  }

  @Get('suppliers/:doc/statement')
  async supplierStatement(@Param('doc') doc: string, @CurrentCompany() companyId?: string) {
    return this.purchasesService.supplierStatement(requirePurchaseCompanyId(companyId), doc);
  }

  @Post('payables')
  @HttpCode(HttpStatus.CREATED)
  async createManualPayable(@Body() dto: CreateManualPayableDto, @CurrentCompany() companyId?: string) {
    return this.purchasesService.createManualPayable(requirePurchaseCompanyId(companyId), dto);
  }

  @Get('payables')
  async listPayables(@CurrentCompany() companyId?: string) {
    return this.purchasesService.listPayables(requirePurchaseCompanyId(companyId));
  }

  @Get()
  async listPurchases(@CurrentCompany() companyId?: string) {
    const purchases = await this.purchasesService.listPurchases(requirePurchaseCompanyId(companyId));
    return mapPurchasesListResponse(purchases, true);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  async receivePurchase(@Param('id') id: string, @Body() dto: ReceivePurchaseDto, @CurrentCompany() companyId?: string) {
    return this.purchasesService.receivePurchase(requirePurchaseCompanyId(companyId), id, dto);
  }

  @Get(':id')
  async getPurchaseById(
    @Param('id') id: string,
    @CurrentCompany() companyId?: string,
  ) {
    const purchase = await this.purchasesService.getPurchaseById(
      requirePurchaseCompanyId(companyId),
      id,
    );
    return mapPurchaseRecord(purchase, { includeExtended: true, includeItemsCount: false });
  }
}

