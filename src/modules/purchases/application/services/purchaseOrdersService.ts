import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { PurchasesService } from './purchasesService';
import type { ConvertPurchaseOrderDto, CreatePurchaseOrderDto } from '../dto/purchaseOrderDto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const map = (o: any) => ({
  id: o.id, orderNumber: o.order_number, supplierDocNumber: o.supplier_doc_number, supplierName: o.supplier_name,
  warehouseCode: o.warehouse_code, issueDate: o.issue_date, expectedDate: o.expected_date, status: o.status,
  pricesIncludeIgv: o.prices_include_igv, netAmount: Number(o.net_amount), igvAmount: Number(o.igv_amount),
  totalAmount: Number(o.total_amount), notes: o.notes, convertedPurchaseId: o.converted_purchase_id,
  items: (o.items ?? []).map((i: any) => ({ id: i.id, sku: i.sku, description: i.description, quantity: Number(i.quantity), unitCost: Number(i.unit_cost), subtotal: Number(i.subtotal), igvAmount: Number(i.igv_amount), totalAmount: Number(i.total_amount) })),
});

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly purchases: PurchasesService) {}

  async list(companyId: string) {
    return (await this.prisma.purchaseOrder.findMany({ where: { company_id: companyId }, include: { items: true }, orderBy: { created_at: 'desc' }, take: 100 })).map(map);
  }

  async get(companyId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, company_id: companyId }, include: { items: true } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada.');
    return map(order);
  }

  async create(companyId: string, dto: CreatePurchaseOrderDto, createdBy?: string) {
    const year = new Date(dto.issueDate).getUTCFullYear();
    const ultima = await this.prisma.purchaseOrder.findFirst({ where: { company_id: companyId, order_number: { startsWith: `OC-${year}-` } }, orderBy: { order_number: 'desc' } });
    const secuencia = ultima ? Number(ultima.order_number.split('-')[2]) + 1 : 1;
    const items: any[] = [];
    let net = 0, igv = 0, total = 0;
    for (const item of dto.items) {
      const product = await this.prisma.inventoryProduct.findFirst({ where: { company_id: companyId, sku: item.sku, is_active: true } });
      if (!product) throw new NotFoundException(`Producto ${item.sku} no encontrado.`);
      const cantidad = Number(item.quantity);
      const precio = Number(item.unitCost);
      if (!(cantidad > 0) || !Number.isFinite(precio) || precio < 0) throw new BadRequestException(`Cantidad o costo inválido para ${item.sku}.`);
      const totalLinea = r2(cantidad * precio);
      const subtotal = dto.pricesIncludeIgv ? r2(totalLinea / 1.18) : totalLinea;
      const igvLinea = dto.pricesIncludeIgv ? r2(totalLinea - subtotal) : r2(subtotal * 0.18);
      const totalFinal = dto.pricesIncludeIgv ? totalLinea : r2(subtotal + igvLinea);
      net += subtotal; igv += igvLinea; total += totalFinal;
      items.push({ product_id: product.id, sku: product.sku, description: item.description?.trim() || product.description, unit_code: product.sunat_unit_code ?? 'NIU', quantity: cantidad, unit_cost: r4(dto.pricesIncludeIgv ? subtotal / cantidad : precio), subtotal, igv_amount: igvLinea, total_amount: totalFinal });
    }
    const order = await this.prisma.purchaseOrder.create({ data: {
      company_id: companyId, order_number: `OC-${year}-${String(secuencia).padStart(4, '0')}`,
      supplier_id: dto.supplierId || null, supplier_doc_number: dto.supplierDocNumber.trim(), supplier_name: dto.supplierName.trim(),
      warehouse_code: dto.warehouseCode || 'ALM-01', issue_date: new Date(dto.issueDate), expected_date: dto.expectedDate ? new Date(dto.expectedDate) : null,
      prices_include_igv: dto.pricesIncludeIgv === true, net_amount: r2(net), igv_amount: r2(igv), total_amount: r2(total),
      notes: dto.notes?.trim() || null, created_by: createdBy || null,
      items: { create: items },
    }, include: { items: true } });
    return map(order);
  }

  async approve(companyId: string, id: string) {
    const order = await this.require(companyId, id);
    if (order.status === 'APROBADA') return map(order);
    if (order.status !== 'BORRADOR') throw new BadRequestException('Solo una orden en borrador puede aprobarse.');
    return this.updateStatus(id, 'APROBADA');
  }

  async cancel(companyId: string, id: string) {
    const order = await this.require(companyId, id);
    if (order.status === 'CONVERTIDA') throw new BadRequestException('La orden ya fue convertida en compra.');
    if (order.status === 'ANULADA') return map(order);
    return this.updateStatus(id, 'ANULADA');
  }

  async convert(companyId: string, id: string, dto: ConvertPurchaseOrderDto) {
    const order = await this.require(companyId, id);
    if (order.status !== 'APROBADA') throw new BadRequestException('La orden debe estar aprobada para convertirse en compra.');
    const compra = await this.purchases.createPurchase(companyId, {
      supplierDocNumber: order.supplier_doc_number, supplierName: order.supplier_name, supplierId: order.supplier_id ?? undefined,
      documentTypeCode: dto.documentTypeCode, documentSerial: dto.documentSerial, documentNumber: dto.documentNumber,
      issueDate: dto.issueDate ?? new Date().toISOString().slice(0, 10), warehouseCode: order.warehouse_code,
      pricesIncludeIgv: order.prices_include_igv, notes: order.notes ?? undefined,
      items: order.items.map((i) => ({ sku: i.sku, quantity: Number(i.quantity), unitCost: Number(i.unit_cost) })),
    });
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CONVERTIDA', converted_purchase_id: compra.id } });
    return { order: await this.get(companyId, id), purchase: compra };
  }

  private async require(companyId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, company_id: companyId }, include: { items: true } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada.');
    return order;
  }

  private async updateStatus(id: string, status: 'APROBADA' | 'ANULADA') {
    const order = await this.prisma.purchaseOrder.update({ where: { id }, data: { status }, include: { items: true } });
    return map(order);
  }
}
