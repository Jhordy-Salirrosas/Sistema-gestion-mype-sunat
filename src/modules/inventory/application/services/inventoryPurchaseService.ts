import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import { CreateNationalPurchaseDto } from '../dto/nationalPurchaseDto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Servicio de Compras Nacionales (Fase 2).
 *
 * Registra facturas/boletas de compra de proveedores nacionales:
 * 1. Genera los movimientos de entrada al Kardex con código de operación 02 (Tabla 12 SUNAT).
 * 2. Actualiza el stock y el costo promedio ponderado en `inventory_balances`.
 * 3. Registra el IGV crédito fiscal y la cuenta por pagar al proveedor en `national_purchases`.
 */
@Injectable()
export class InventoryPurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  async listPurchases(companyId: string) {
    return this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId },
      include: {
        items: true,
      },
      orderBy: { issue_date: 'desc' },
      take: 200,
    });
  }

  async getPurchaseById(companyId: string, id: string) {
    const purchase = await this.prisma.nationalPurchase.findFirst({
      where: { id, company_id: companyId },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra nacional con id ${id} no encontrada.`);
    }

    return purchase;
  }

  async createPurchase(companyId: string, dto: CreateNationalPurchaseDto) {
    const supplierDoc = dto.supplierDocNumber.trim();
    const supplierName = dto.supplierName.trim();
    const docTypeCode = (dto.documentTypeCode ?? '01').trim();
    const docSerial = dto.documentSerial.trim().toUpperCase();
    const docNumber = dto.documentNumber.trim();
    const warehouseCode = (dto.warehouseCode ?? 'ALM-01').trim().toUpperCase();
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const currencyCode = (dto.currencyCode ?? 'PEN').trim().toUpperCase();

    // Validar que no se repitan SKUs en el mismo comprobante de compra
    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo producto/SKU en la factura de compra.');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Validar almacén
      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: warehouseCode },
      });
      if (!warehouse) {
        throw new NotFoundException(`Almacén ${warehouseCode} no encontrado en la empresa.`);
      }

      // 2. Validar duplicidad de comprobante de compra (Idempotencia fiscal)
      const existing = await tx.nationalPurchase.findFirst({
        where: {
          company_id: companyId,
          supplier_doc_number: supplierDoc,
          document_type_code: docTypeCode,
          document_serial: docSerial,
          document_number: docNumber,
        },
      });

      if (existing) {
        throw new ConflictException(
          `La factura/comprobante ${docSerial}-${docNumber} del proveedor ${supplierDoc} ya fue registrada.`,
        );
      }

      // 3. Vincular o resolver proveedor en BusinessPartner
      let supplierId = dto.supplierId;
      if (!supplierId) {
        const partner = await tx.businessPartner.findFirst({
          where: {
            company_id: companyId,
            doc_number: supplierDoc,
          },
        });
        if (partner) {
          supplierId = partner.id;
        }
      }

      const purchaseNumber = `COM-${Date.now().toString().slice(-8)}`;

      // 4. Procesar ítems, calcular costos, IGV y Kardex
      let totalNet = 0;
      let totalIgv = 0;
      let totalAmount = 0;

      const preparedItems: any[] = [];
      const movementRows: any[] = [];

      for (const item of dto.items) {
        const sku = item.sku.trim().toUpperCase();
        const product = await tx.inventoryProduct.findFirst({
          where: { company_id: companyId, sku },
        });

        if (!product) {
          throw new NotFoundException(`Producto con SKU ${sku} no encontrado.`);
        }
        if (!product.is_inventory) {
          throw new BadRequestException(`El ítem ${sku} (${product.description}) es un servicio y no mueve inventario.`);
        }

        const quantity = item.quantity;
        const unitCostNet = item.unitCost; // Costo unitario neto sin IGV (base contable para Kardex)
        const subtotal = r2(quantity * unitCostNet);
        const itemIgv = r2(subtotal * 0.18);
        const itemTotal = r2(subtotal + itemIgv);

        totalNet += subtotal;
        totalIgv += itemIgv;
        totalAmount += itemTotal;

        // Obtener saldo previo en el almacén
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
            },
          },
        });

        const prevStock = Number(balance?.current_stock ?? 0);
        const prevAvgCost = Number(balance?.average_unit_cost ?? 0);
        const prevTotalVal = Number(balance?.total_inventory_value ?? 0);

        // Calcular costo promedio ponderado resultante
        const calc = MovingWeightedAverageEngine.calculate({
          previousStock: prevStock,
          previousAverageCost: prevAvgCost,
          previousTotalValue: prevTotalVal,
          movementDirection: 'ENTRADA',
          quantity,
          unitCost: unitCostNet,
        });

        const sourceRef = `${purchaseNumber}-${sku}`;

        // Preparar movimiento Kardex (Operación 02 - Compra Nacional)
        movementRows.push({
          company_id: companyId,
          warehouse_id: warehouse.id,
          product_id: product.id,
          movement_number: `MOV-${purchaseNumber}-${sku}`,
          movement_date: issueDate,
          accounting_date: issueDate,
          operation_type_code: '02', // 02 = Compra Nacional
          document_type_code: docTypeCode,
          document_serial: docSerial,
          document_number: docNumber,
          direction: 'ENTRADA',
          quantity: calc.movementQuantity,
          unit_cost: r4(calc.movementUnitCost),
          total_cost: r2(calc.movementTotalCost),
          previous_stock: r4(prevStock),
          previous_unit_cost: r4(prevAvgCost),
          previous_total_value: r2(prevTotalVal),
          resulting_stock: calc.resultingStock,
          resulting_unit_cost: r4(calc.resultingAverageCost),
          resulting_total_value: r2(calc.resultingTotalValue),
          source_reference_id: sourceRef,
          source_module: 'PURCHASES',
          notes: dto.notes ?? `Compra nacional ${docSerial}-${docNumber} (${supplierName})`,
        });

        // Actualizar saldo del almacén
        await tx.inventoryBalance.upsert({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
            },
          },
          create: {
            company_id: companyId,
            warehouse_id: warehouse.id,
            product_id: product.id,
            current_stock: calc.resultingStock,
            average_unit_cost: r4(calc.resultingAverageCost),
            total_inventory_value: r2(calc.resultingTotalValue),
            last_movement_at: issueDate,
          },
          update: {
            current_stock: calc.resultingStock,
            average_unit_cost: r4(calc.resultingAverageCost),
            total_inventory_value: r2(calc.resultingTotalValue),
            last_movement_at: issueDate,
          },
        });

        preparedItems.push({
          product_id: product.id,
          sku,
          description: product.description,
          unit_code: product.sunat_unit_code ?? 'NIU',
          quantity,
          unit_cost: r4(unitCostNet),
          subtotal,
          igv_amount: itemIgv,
          total_amount: itemTotal,
        });
      }

      // 5. Asentar todos los movimientos de Kardex en lote
      for (const mov of movementRows) {
        await tx.inventoryMovement.create({ data: mov });
      }

      // 6. Crear la cabecera de la Compra Nacional con su IGV y CxP
      const purchase = await tx.nationalPurchase.create({
        data: {
          company_id: companyId,
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          supplier_doc_type: '6',
          supplier_doc_number: supplierDoc,
          supplier_name: supplierName,
          document_type_code: docTypeCode,
          document_serial: docSerial,
          document_number: docNumber,
          issue_date: issueDate,
          accounting_date: issueDate,
          currency_code: currencyCode,
          warehouse_code: warehouseCode,
          net_amount: r2(totalNet),
          igv_amount: r2(totalIgv),
          total_amount: r2(totalAmount),
          status: 'REGISTRADA',
          notes: dto.notes,
          responsible: dto.responsible,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
        },
      });

      return {
        id: purchase.id,
        purchaseNumber: purchase.purchase_number,
        supplierDocNumber: purchase.supplier_doc_number,
        supplierName: purchase.supplier_name,
        documentTypeCode: purchase.document_type_code,
        documentSerial: purchase.document_serial,
        documentNumber: purchase.document_number,
        issueDate: purchase.issue_date,
        warehouseCode: purchase.warehouse_code,
        netAmount: Number(purchase.net_amount),
        igvAmount: Number(purchase.igv_amount),
        totalAmount: Number(purchase.total_amount),
        status: purchase.status,
        itemsCount: purchase.items.length,
        items: purchase.items.map((i: any) => ({
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
    });
  }
}

