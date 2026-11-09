import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import { CreateNationalPurchaseDto } from '../dto/nationalPurchaseDto';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

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
  private readonly logger = new Logger(InventoryPurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly accounting?: GenerateAccountingEntryUseCase,
  ) {}

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

    const empresa = await (this.prisma as any).company?.findUnique?.({
      where: { id: companyId },
      select: { inventory_cost_method: true },
    });
    const usaFifo = empresa?.inventory_cost_method === 'FIFO';

    const result = await this.prisma.$transaction(async (tx: any) => {
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

        if (usaFifo) {
          await tx.inventoryCostLayer.create({
            data: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
              quantity_remaining: quantity,
              unit_cost: r4(unitCostNet),
            },
          });
        }

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

    await this.registrarAsientoCompra(companyId, result, issueDate);
    return result;
  }

  async listPayments(companyId: string, id: string) {
    const purchase = await this.prisma.nationalPurchase.findFirst({ where: { id, company_id: companyId }, select: { purchase_number: true } });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    const pagos = await this.prisma.treasuryMovement.findMany({
      where: { company_id: companyId, source_module: 'PURCHASES', source_reference_id: purchase.purchase_number, direction: 'EGRESO' },
      orderBy: { movement_date: 'desc' },
    });
    return pagos.map((p) => ({
      id: p.id,
      date: p.movement_date,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      bankName: p.bank_name,
      concept: p.concept,
    }));
  }

  async listPayables(companyId: string) {
    const compras = await this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId, status: { not: 'ANULADA' } },
      select: { supplier_doc_number: true, supplier_name: true, total_amount: true, paid_amount: true },
    });
    const mapa = new Map<string, { supplierDocNumber: string; supplierName: string; total: number; paid: number; balance: number; count: number }>();
    for (const c of compras) {
      const actual = mapa.get(c.supplier_doc_number) ?? { supplierDocNumber: c.supplier_doc_number, supplierName: c.supplier_name, total: 0, paid: 0, balance: 0, count: 0 };
      const total = Number(c.total_amount);
      const paid = Number(c.paid_amount ?? 0);
      actual.total += total;
      actual.paid += paid;
      actual.balance += total - paid;
      actual.count += 1;
      mapa.set(c.supplier_doc_number, actual);
    }
    return [...mapa.values()].map((c) => ({ ...c, total: Math.round(c.total * 100) / 100, paid: Math.round(c.paid * 100) / 100, balance: Math.round(c.balance * 100) / 100 }));
  }

  /** Registra un pago total o parcial y su asiento CxP contra caja/banco. */
  async payPurchase(companyId: string, id: string, dto: { amount?: number; paymentDate?: string; paymentMethod?: string; bankName?: string }) {
    const purchase = await this.prisma.nationalPurchase.findFirst({ where: { id, company_id: companyId }, include: { items: true } });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    if (purchase.status === 'ANULADA') throw new BadRequestException('La compra está anulada.');
    if (purchase.status === 'PAGADA') throw new BadRequestException('La compra ya está pagada.');

    const total = Number(purchase.total_amount);
    const pagado = Number(purchase.paid_amount ?? 0);
    const saldo = Math.round((total - pagado) * 100) / 100;
    const monto = Math.round(Number(dto.amount ?? saldo) * 100) / 100;
    if (!(monto > 0) || monto > saldo) throw new BadRequestException(`El monto debe estar entre 0.01 y ${saldo.toFixed(2)}.`);
    const fecha = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const metodo = dto.paymentMethod ?? 'TRANSFERENCIA';
    const nuevoPagado = Math.round((pagado + monto) * 100) / 100;
    const nuevoEstado = nuevoPagado >= total - 0.005 ? 'PAGADA' : 'PAGO_PARCIAL';

    const movimiento = await this.prisma.$transaction(async (tx: any) => {
      const creado = await tx.treasuryMovement.create({
        data: {
          company_id: companyId,
          movement_date: fecha,
          direction: 'EGRESO',
          document_reference: `${purchase.document_serial}-${purchase.document_number}`,
          counterpart_name: purchase.supplier_name,
          concept: `Pago ${nuevoEstado === 'PAGADA' ? 'total' : 'parcial'} compra ${purchase.purchase_number}`,
          amount: monto,
          source_module: 'PURCHASES',
          source_reference_id: purchase.purchase_number,
          payment_method: metodo,
          bank_name: dto.bankName ?? null,
        },
      });
      await tx.nationalPurchase.update({ where: { id }, data: { status: nuevoEstado, paid_amount: nuevoPagado } });
      return creado;
    });

    if (this.accounting) {
      const mappings = (await (this.prisma as any).accountingMapping?.findMany({ where: { company_id: companyId, process_code: 'COMPRA', is_active: true } })) ?? [];
      const roles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
      const cxp = roles.get('CXP') || '421';
      const caja = metodo === 'EFECTIVO' ? (roles.get('CAJA') || '101') : (roles.get('BANCO') || '1041');
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      await this.accounting.execute({
        companyId, period: periodo, entryDate: fecha.toISOString(),
        glosa: `Pago ${nuevoEstado === 'PAGADA' ? 'total' : 'parcial'} compra ${purchase.purchase_number} · ${purchase.supplier_name}`,
        sourceModule: 'PURCHASES',
        sourceReferenceId: `PAGO-${purchase.purchase_number}-${movimiento.id}`,
        idempotencyKey: `purchase-payment:${movimiento.id}`,
        lines: [
          { lineOrder: 1, accountCode: cxp, accountName: 'Cuentas por pagar comerciales', debitAmount: monto, creditAmount: 0 },
          { lineOrder: 2, accountCode: caja, accountName: metodo === 'EFECTIVO' ? 'Caja' : 'Cuenta corriente', debitAmount: 0, creditAmount: monto },
        ],
      });
    }

    return { id, status: nuevoEstado, amount: monto, paidAmount: nuevoPagado, balance: Math.round((total - nuevoPagado) * 100) / 100, paymentMethod: metodo };
  }

  /** Asiento de compra PCGE: Naturaleza (60/40/42) y Destino al almacén (20/61). */
  private async registrarAsientoCompra(
    companyId: string,
    purchase: any,
    issueDate: Date,
  ): Promise<void> {
    if (!this.accounting) return;

    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: companyId,
        source_module: 'PURCHASES',
        source_reference_id: purchase.purchaseNumber,
      },
      select: { id: true },
    });
    if (existente) return;

    // Consultar mapeador dinámico de cuentas para COMPRA si existe
    const mappings = (await (this.prisma as any).accountingMapping?.findMany({
      where: { company_id: companyId, process_code: 'COMPRA', is_active: true },
    })) ?? [];
    const mapRoles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));

    const accGastoCompra = mapRoles.get('GASTO_COMPRA') || '601';
    const accIgvCredito = mapRoles.get('IGV_CREDITO') || '40111';
    const accCxp = mapRoles.get('CXP') || '421';
    const accDestinoInv = mapRoles.get('DESTINO_INVENTARIO') || '201';
    const accVariacionExist = mapRoles.get('VARIACION_EXISTENCIA') || '611';

    const periodo = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
    try {
      await this.accounting.execute({
        companyId,
        period: periodo,
        entryDate: issueDate.toISOString(),
        glosa: `Compra ${purchase.documentSerial}-${purchase.documentNumber} · ${purchase.supplierName}`,
        sourceModule: 'PURCHASES',
        sourceReferenceId: purchase.purchaseNumber,
        lines: [
          // 1. Naturaleza: Compra de mercaderías
          {
            lineOrder: 1,
            accountCode: accGastoCompra,
            accountName: 'Mercaderías manufacturadas (Gasto Compra)',
            debitAmount: purchase.netAmount,
            creditAmount: 0,
          },
          // 2. Naturaleza: IGV Crédito fiscal
          {
            lineOrder: 2,
            accountCode: accIgvCredito,
            accountName: 'IGV - Cuenta propia / Crédito fiscal',
            debitAmount: purchase.igvAmount,
            creditAmount: 0,
          },
          // 3. Naturaleza: Cuentas por pagar comerciales a proveedores
          {
            lineOrder: 3,
            accountCode: accCxp,
            accountName: 'Facturas por pagar emitidas',
            debitAmount: 0,
            creditAmount: purchase.totalAmount,
          },
          // 4. Destino PCGE: Entrada de existencias a almacén
          {
            lineOrder: 4,
            accountCode: accDestinoInv,
            accountName: 'Mercaderías en almacén (Destino)',
            debitAmount: purchase.netAmount,
            creditAmount: 0,
          },
          // 5. Destino PCGE: Variación de existencias
          {
            lineOrder: 5,
            accountCode: accVariacionExist,
            accountName: 'Variación de mercaderías (Destino)',
            debitAmount: 0,
            creditAmount: purchase.netAmount,
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        `Compra ${purchase.purchaseNumber} registrada sin asiento: ${(error as Error).message}`,
      );
    }
  }
}

