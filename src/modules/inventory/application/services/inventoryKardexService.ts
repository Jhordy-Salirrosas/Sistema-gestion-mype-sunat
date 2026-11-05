import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { SunatTable12VO } from '../../domain/value-objects/sunatTable12Vo';

export interface KardexFilters {
  sku?: string;
  warehouse?: string;
  startDate?: string;
  endDate?: string;
  operation?: string;
  document?: string;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Kardex general: movimientos valorizados con saldo inicial y totales.
 * Es una vista de lectura sobre `inventory_movements`; no escribe stock.
 */
@Injectable()
export class InventoryKardexService {
  constructor(private readonly prisma: PrismaService) {}

  async getKardex(companyId: string, filters: KardexFilters) {
    const start = filters.startDate ? new Date(filters.startDate) : undefined;
    const end = filters.endDate ? new Date(filters.endDate) : undefined;

    // Resolver el SKU y el almacén a IDs evita diferencias entre el filtro de
    // movimientos y el de saldo inicial, y funciona igual con relaciones nulas.
    const product = filters.sku
      ? await this.prisma.inventoryProduct.findFirst({
          where: { company_id: companyId, sku: filters.sku.trim().toUpperCase() },
        })
      : null;
    const warehouse = filters.warehouse
      ? await this.prisma.inventoryWarehouse.findFirst({
          where: {
            company_id: companyId,
            warehouse_code: filters.warehouse.trim().toUpperCase(),
          },
        })
      : null;

    // Un filtro que no existe debe devolver vacío, no el universo completo.
    if (filters.sku && !product) {
      return this.emptyResponse(filters);
    }
    if (filters.warehouse && !warehouse) {
      return this.emptyResponse(filters);
    }

    // Filtros de alcance: se usan para el saldo inicial aunque el usuario
    // filtre por operación o documento.
    const scopeWhere: any = {
      company_id: companyId,
      archived_at: null,
      ...(product ? { product_id: product.id } : {}),
      ...(warehouse ? { warehouse_id: warehouse.id } : {}),
    };

    const dateRange = start || end
      ? {
          movement_date: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {};

    const warehouseRows = await this.prisma.inventoryWarehouse.findMany({
      where: { company_id: companyId },
      select: { id: true, warehouse_code: true },
    });
    const warehouseCodeById = new Map(
      warehouseRows.map((w) => [w.id, w.warehouse_code]),
    );

    // Saldo inicial por almacén: último movimiento anterior al rango, más los
    // movimientos tipo 16 que caigan dentro del rango.
    const openingByWarehouse = new Map<string, { stock: number; value: number }>();
    const addOpening = (warehouseId: string, stock: number, value: number) => {
      const current = openingByWarehouse.get(warehouseId) ?? { stock: 0, value: 0 };
      current.stock += stock;
      current.value += value;
      openingByWarehouse.set(warehouseId, current);
    };

    if (start) {
      const previous = await this.prisma.inventoryMovement.findMany({
        where: { ...scopeWhere, movement_date: { lt: start } },
        orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
        select: {
          product_id: true,
          warehouse_id: true,
          resulting_stock: true,
          resulting_total_value: true,
        },
        take: 5000,
      });

      const seen = new Set<string>();
      for (const row of previous) {
        const key = `${row.product_id}:${row.warehouse_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        addOpening(
          row.warehouse_id,
          Number(row.resulting_stock),
          Number(row.resulting_total_value),
        );
      }
    }

    const openingInPeriod = await this.prisma.inventoryMovement.findMany({
      where: {
        ...scopeWhere,
        operation_type_code: '16',
        ...dateRange,
      },
      select: {
        warehouse_id: true,
        resulting_stock: true,
        resulting_total_value: true,
      },
      take: 5000,
    });

    for (const row of openingInPeriod) {
      addOpening(
        row.warehouse_id,
        Number(row.resulting_stock),
        Number(row.resulting_total_value),
      );
    }

    let openingStock = 0;
    let openingValue = 0;
    for (const value of openingByWarehouse.values()) {
      openingStock += value.stock;
      openingValue += value.value;
    }

    // Los movimientos tipo 16 ya se muestran en la tarjeta de saldo inicial:
    // no se repiten como entradas del periodo.
    const movementWhere: any = {
      ...scopeWhere,
      ...(filters.document ? { document_type_code: filters.document } : {}),
      ...(filters.operation ? { operation_type_code: filters.operation } : { operation_type_code: { not: '16' } }),
      ...dateRange,
    };

    const total = await this.prisma.inventoryMovement.count({ where: movementWhere });
    const rows = await this.prisma.inventoryMovement.findMany({
      where: movementWhere,
      include: { product: true, warehouse: true },
      orderBy: [{ movement_date: 'asc' }, { created_at: 'asc' }],
      take: 500,
    });

    const isConsolidated = !filters.warehouse;
    let entries = 0;
    let exits = 0;
    let entriesQty = 0;
    let exitsQty = 0;
    let transferInQty = 0;
    let transferOutQty = 0;
    let transferInValue = 0;
    let transferOutValue = 0;
    let transferCount = 0;
    let running = openingStock;

    // Saldo corriente por almacén para la tarjeta de cierre.
    const warehouseBalance = new Map(
      [...openingByWarehouse.entries()].map(([id, v]) => [id, { ...v }]),
    );

    const movements = rows.map((row) => {
      const quantity = Number(row.quantity);
      const totalCost = Number(row.total_cost);
      const isInternalTransfer = row.operation_type_code === '21' || row.operation_type_code === '22';

      if (isInternalTransfer) {
        transferCount += 1;
        if (row.direction === 'ENTRADA') {
          transferInQty += quantity;
          transferInValue += totalCost;
        } else {
          transferOutQty += quantity;
          transferOutValue += totalCost;
        }
      }

      // En consolidado, una transferencia interna no altera el stock total.
      const affectsConsolidated = isConsolidated ? !isInternalTransfer : true;

      if (isConsolidated) {
        if (!isInternalTransfer) {
          if (row.direction === 'ENTRADA') {
            entries += totalCost;
            entriesQty += quantity;
          } else {
            exits += totalCost;
            exitsQty += quantity;
          }
        }
      } else {
        if (row.direction === 'ENTRADA') {
          entries += totalCost;
          entriesQty += quantity;
        } else {
          exits += totalCost;
          exitsQty += quantity;
        }
      }

      if (affectsConsolidated) {
        running += row.direction === 'ENTRADA' ? quantity : -quantity;
      }

      const currentWarehouse = warehouseBalance.get(row.warehouse_id) ?? {
        stock: 0,
        value: 0,
      };
      currentWarehouse.stock += row.direction === 'ENTRADA' ? quantity : -quantity;
      currentWarehouse.value += row.direction === 'ENTRADA' ? totalCost : -totalCost;
      warehouseBalance.set(row.warehouse_id, currentWarehouse);

      let operationLabel = `Operación ${row.operation_type_code}`;
      try {
        operationLabel = new SunatTable12VO(row.operation_type_code).description;
      } catch {
        // El catálogo puede haber cambiado; se muestra el código.
      }

      return {
        id: row.id,
        date: row.movement_date,
        movementNumber: row.movement_number,
        operationTypeCode: row.operation_type_code,
        operationLabel,
        documentTypeCode: row.document_type_code,
        documentSerial: row.document_serial,
        documentNumber: row.document_number,
        sku: row.product?.sku ?? 'SIN-SKU',
        description: row.product?.description ?? 'Producto sin descripción',
        unitCode: row.product?.sunat_unit_code ?? 'NIU',
        warehouseCode: row.warehouse?.warehouse_code ?? 'ALM-01',
        direction: row.direction,
        quantity,
        unitCost: Number(row.unit_cost),
        totalCost,
        resultingStock: Number(row.resulting_stock),
        resultingAverageCost: Number(row.resulting_unit_cost),
        resultingTotalValue: Number(row.resulting_total_value),
        sourceModule: row.source_module,
        isInternalTransfer,
        affectsConsolidated,
        balanceAfter: running,
      };
    });

    const finalStock = openingStock + entriesQty - exitsQty;
    const finalValue = openingValue + entries - exits;

    const warehouses = [...warehouseBalance.entries()]
      .map(([id, value]) => ({
        warehouseCode: warehouseCodeById.get(id) ?? id,
        stock: value.stock,
        value: r2(value.value),
      }))
      .sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode));

    return {
      mode: isConsolidated ? 'CONSOLIDATED' : 'WAREHOUSE',
      filters: {
        sku: filters.sku ?? null,
        warehouse: filters.warehouse ?? null,
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        operation: filters.operation ?? null,
        document: filters.document ?? null,
      },
      opening: {
        stock: openingStock,
        unitCost: openingStock > 0 ? r2(openingValue / openingStock) : 0,
        totalValue: r2(openingValue),
      },
      totals: {
        entries: r2(entries),
        exits: r2(exits),
        entriesQuantity: entriesQty,
        exitsQuantity: exitsQty,
        count: total,
      },
      internalTransfers: {
        count: transferCount,
        entriesQuantity: transferInQty,
        exitsQuantity: transferOutQty,
        entriesValue: r2(transferInValue),
        exitsValue: r2(transferOutValue),
      },
      final: {
        stock: finalStock,
        unitCost: finalStock > 0 ? r2(finalValue / finalStock) : 0,
        totalValue: r2(finalValue),
      },
      warehouses,
      movements,
    };
  }

  private emptyResponse(filters: KardexFilters) {
    return {
      mode: filters.warehouse ? 'WAREHOUSE' : 'CONSOLIDATED',
      filters: {
        sku: filters.sku ?? null,
        warehouse: filters.warehouse ?? null,
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        operation: filters.operation ?? null,
        document: filters.document ?? null,
      },
      opening: { stock: 0, unitCost: 0, totalValue: 0 },
      totals: {
        entries: 0,
        exits: 0,
        entriesQuantity: 0,
        exitsQuantity: 0,
        count: 0,
      },
      internalTransfers: {
        count: 0,
        entriesQuantity: 0,
        exitsQuantity: 0,
        entriesValue: 0,
        exitsValue: 0,
      },
      final: { stock: 0, unitCost: 0, totalValue: 0 },
      warehouses: [],
      movements: [],
    };
  }

  /**
   * Pestaña 2: Caja y Bancos (Dinero - § 8.2 del Plan Maestro).
   * Muestra las entradas y salidas de dinero por cobros, pagos y tributos aduaneros
   * sin mezclarse con las unidades físicas del PLE 13.1.
   */
  async getCashAndBanks(
    companyId: string,
    filters: { startDate?: string; endDate?: string; direction?: string },
  ) {
    const where: any = { company_id: companyId };
    if (filters.direction) where.direction = filters.direction;
    if (filters.startDate || filters.endDate) {
      where.movement_date = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    let records = await this.prisma.treasuryMovement.findMany({
      where,
      orderBy: { movement_date: 'asc' },
    });

    // Si aún no hay movimientos directos de tesorería, sincronizar a partir de
    // facturas de venta aceptadas, compras nacionales y liquidaciones aduaneras.
    if (records.length === 0) {
      const sales = await this.prisma.invoice.findMany({
        where: { company_id: companyId, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
        take: 20,
      });

      const purchases = await this.prisma.nationalPurchase.findMany({
        where: { company_id: companyId },
        take: 20,
      });

      const customs = await this.prisma.customsDeclaration.findMany({
        where: { company_id: companyId },
        take: 20,
      });

      const autoMovements = [
        ...sales.map((s) => ({
          company_id: companyId,
          movement_date: s.fecha_emision,
          direction: 'INGRESO',
          document_reference: `${s.serie}-${String(s.correlativo).padStart(8, '0')}`,
          counterpart_name: s.customer_legal_name || 'CLIENTE LOCAL',
          concept: `Cobro de Factura Electrónica ${s.serie}-${s.correlativo}`,
          amount: s.monto_total,
          currency_code: s.currency_code || 'PEN',
          source_module: 'INVOICES',
          source_reference_id: s.id,
          payment_method: 'TRANSFERENCIA',
          bank_name: 'BCP',
        })),
        ...purchases.map((p) => ({
          company_id: companyId,
          movement_date: p.issue_date,
          direction: 'EGRESO',
          document_reference: `${p.document_serial}-${p.document_number}`,
          counterpart_name: p.supplier_name,
          concept: `Pago a Proveedor Nacional por Compra ${p.purchase_number}`,
          amount: p.total_amount,
          currency_code: p.currency_code,
          source_module: 'PURCHASES',
          source_reference_id: p.id,
          payment_method: 'TRANSFERENCIA',
          bank_name: 'BBVA',
        })),
        ...customs.map((c) => ({
          company_id: companyId,
          movement_date: c.created_at,
          direction: 'EGRESO',
          document_reference: `DAM ${c.customs_code}-${c.declaration_year}-${c.regime_code}-${c.dua_number}`,
          counterpart_name: 'SUNAT - ADUANAS CALLAO',
          concept: 'Pago de Tributos de Importación (Ad-Valorem, IGV, IPM, Percepción) con CDA',
          amount: c.total_customs_taxes_pen,
          currency_code: 'PEN',
          source_module: 'CUSTOMS',
          source_reference_id: c.id,
          payment_method: 'DEPOSITO',
          bank_name: 'BANCO DE LA NACION',
        })),
      ];

      if (autoMovements.length > 0) {
        await this.prisma.treasuryMovement.createMany({
          data: autoMovements,
          skipDuplicates: true,
        });
        records = await this.prisma.treasuryMovement.findMany({
          where,
          orderBy: { movement_date: 'asc' },
        });
      }
    }

    let runningBalance = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;

    const items = records.map((r) => {
      const amt = Number(r.amount);
      if (r.direction === 'INGRESO') {
        runningBalance += amt;
        totalIngresos += amt;
      } else {
        runningBalance -= amt;
        totalEgresos += amt;
      }

      return {
        id: r.id,
        date: r.movement_date.toISOString().slice(0, 10),
        direction: r.direction,
        documentReference: r.document_reference,
        counterpartName: r.counterpart_name,
        concept: r.concept,
        amount: amt,
        currencyCode: r.currency_code,
        paymentMethod: r.payment_method,
        bankName: r.bank_name,
        sourceModule: r.source_module,
        runningBalance: r2(runningBalance),
      };
    });

    return {
      totals: {
        totalIngresos: r2(totalIngresos),
        totalEgresos: r2(totalEgresos),
        netBalance: r2(totalIngresos - totalEgresos),
        count: items.length,
      },
      items,
    };
  }

  /**
   * Pestaña 3: Consolidado de Inventario (§ 8.2 del Plan Maestro).
   * Resumen por producto y almacén con stock actual, costo promedio y valor total en soles.
   */
  async getConsolidated(companyId: string) {
    const products = await this.prisma.inventoryProduct.findMany({
      where: { company_id: companyId, is_active: true },
      include: {
        balances: {
          include: { warehouse: true },
        },
      },
      orderBy: { sku: 'asc' },
    });

    let totalStockGlobal = 0;
    let totalValueGlobal = 0;

    const list = products.map((p) => {
      let productStock = 0;
      let productValue = 0;

      const warehouses = p.balances.map((b) => {
        const stock = Number(b.current_stock);
        const avgCost = Number(b.average_unit_cost);
        const val = Number(b.total_inventory_value);
        productStock += stock;
        productValue += val;

        return {
          warehouseCode: b.warehouse.warehouse_code,
          warehouseName: b.warehouse.description,
          stock,
          averageCost: avgCost,
          totalValue: val,
        };
      });

      totalStockGlobal += productStock;
      totalValueGlobal += productValue;

      return {
        id: p.id,
        sku: p.sku,
        description: p.description,
        unitCode: p.sunat_unit_code,
        typeCode: p.sunat_type_code,
        totalStock: productStock,
        averageUnitCost: productStock > 0 ? r2(productValue / productStock) : 0,
        totalValue: r2(productValue),
        warehouses,
      };
    });

    return {
      totalProducts: list.length,
      totalStockGlobal: r2(totalStockGlobal),
      totalValueGlobal: r2(totalValueGlobal),
      products: list,
    };
  }
}
