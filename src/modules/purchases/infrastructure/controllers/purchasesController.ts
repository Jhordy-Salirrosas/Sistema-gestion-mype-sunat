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
import { PurchasesService } from '../../application/services/purchasesService';
import { CreatePurchaseDto } from '../../application/dto/createPurchaseDto';
import { PayPurchaseDto } from '../../application/dto/payPurchaseDto';

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
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.purchasesService.createPurchase(companyId, dto);
  }

  @Get(':id/payments')
  async listPayments(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.purchasesService.listPayments(companyId, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payPurchase(
    @Param('id') id: string,
    @Body() dto: PayPurchaseDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.purchasesService.payPurchase(companyId, id, dto);
  }

  @Get()
  async listPurchases(@CurrentCompany() companyId?: string) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    const purchases = await this.purchasesService.listPurchases(companyId);
    return {
      total: purchases.length,
      items: purchases.map((p) => {
        const netAmount = Number(p.net_amount);
        const igvAmount = Number(p.igv_amount);
        const totalAmount = Number(p.total_amount);
        const paidAmount = Number(p.paid_amount ?? 0);
        const pendingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

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
          currencyCode: (p as any).currency_code ?? 'PEN',
          exchangeRate: Number((p as any).exchange_rate ?? 1),
          netAmount,
          igvAmount,
          totalAmount,
          paidAmount,
          pendingAmount,
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
        };
      }),
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
    const p = await this.purchasesService.getPurchaseById(companyId, id);
    const netAmount = Number(p.net_amount);
    const igvAmount = Number(p.igv_amount);
    const totalAmount = Number(p.total_amount);
    const paidAmount = Number(p.paid_amount ?? 0);
    const pendingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

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
      currencyCode: (p as any).currency_code ?? 'PEN',
      exchangeRate: Number((p as any).exchange_rate ?? 1),
      netAmount,
      igvAmount,
      totalAmount,
      paidAmount,
      pendingAmount,
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

