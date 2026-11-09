import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryPurchaseService } from '../../application/services/inventoryPurchaseService';
import { CreateNationalPurchaseDto } from '../../application/dto/nationalPurchaseDto';
import { PayPurchaseDto } from '../../application/dto/payPurchaseDto';

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
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.purchaseService.createPurchase(companyId, dto);
  }

  @Get(':id/payments')
  async listPayments(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.purchaseService.listPayments(companyId, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payPurchase(
    @Param('id') id: string,
    @Body() dto: PayPurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.purchaseService.payPurchase(companyId, id, dto);
  }

  @Get()
  async listPurchases(@CurrentCompany() companyId?: string) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    const purchases = await this.purchaseService.listPurchases(companyId);
    return {
      total: purchases.length,
      items: purchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchase_number,
        supplierDocNumber: p.supplier_doc_number,
        supplierName: p.supplier_name,
        documentTypeCode: p.document_type_code,
        documentSerial: p.document_serial,
        documentNumber: p.document_number,
        issueDate: p.issue_date,
        warehouseCode: p.warehouse_code,
        netAmount: Number(p.net_amount),
        igvAmount: Number(p.igv_amount),
        totalAmount: Number(p.total_amount),
        status: p.status,
        notes: p.notes,
        responsible: p.responsible,
        itemsCount: p.items.length,
        items: p.items.map((i) => ({
          id: i.id,
          sku: i.sku,
          description: i.description,
          quantity: Number(i.quantity),
          unitCost: Number(i.unit_cost),
          subtotal: Number(i.subtotal),
          igvAmount: Number(i.igv_amount),
          totalAmount: Number(i.total_amount),
        })),
      })),
    };
  }

  @Get(':id')
  async getPurchaseById(
    @Param('id') id: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    const p = await this.purchaseService.getPurchaseById(companyId, id);
    return {
      id: p.id,
      purchaseNumber: p.purchase_number,
      supplierDocNumber: p.supplier_doc_number,
      supplierName: p.supplier_name,
      documentTypeCode: p.document_type_code,
      documentSerial: p.document_serial,
      documentNumber: p.document_number,
      issueDate: p.issue_date,
      warehouseCode: p.warehouse_code,
      netAmount: Number(p.net_amount),
      igvAmount: Number(p.igv_amount),
      totalAmount: Number(p.total_amount),
      status: p.status,
      notes: p.notes,
      responsible: p.responsible,
      items: p.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        description: i.description,
        quantity: Number(i.quantity),
        unitCost: Number(i.unit_cost),
        subtotal: Number(i.subtotal),
        igvAmount: Number(i.igv_amount),
        totalAmount: Number(i.total_amount),
      })),
    };
  }
}

