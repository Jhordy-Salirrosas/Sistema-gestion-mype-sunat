import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { FifoCostEngine, type CostLayer } from '../../domain/rules/FifoCostEngine';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';

const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Persistencia de capas FIFO y motor de configuración y recálculo de costeo. */
@Injectable()
export class InventoryCostLayerService {
  constructor(private readonly prisma: PrismaService) {}

  async metodo(companyId: string): Promise<'PROMEDIO' | 'FIFO'> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { inventory_cost_method: true },
    });
    return company?.inventory_cost_method === 'FIFO' ? 'FIFO' : 'PROMEDIO';
  }

  async capas(companyId: string, warehouseId: string, productId: string): Promise<CostLayer[]> {
    const rows = await this.prisma.inventoryCostLayer.findMany({
      where: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: { gt: 0 } },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => ({ quantity: Number(r.quantity_remaining), unitCost: Number(r.unit_cost) }));
  }

  async registrarEntrada(companyId: string, warehouseId: string, productId: string, quantity: number, unitCost: number) {
    await this.prisma.inventoryCostLayer.create({
      data: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: quantity, unit_cost: unitCost },
    });
  }

  async consumir(companyId: string, warehouseId: string, productId: string, quantity: number) {
    let pendiente = quantity;
    const capas = await this.prisma.inventoryCostLayer.findMany({
      where: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: { gt: 0 } },
      orderBy: { created_at: 'asc' },
    });
    for (const capa of capas) {
      if (pendiente <= 0) break;
      const disponible = Number(capa.quantity_remaining);
      const usar = Math.min(disponible, pendiente);
      await this.prisma.inventoryCostLayer.update({
        where: { id: capa.id },
        data: { quantity_remaining: disponible - usar },
      });
      pendiente -= usar;
    }
  }

  calcular(layers: CostLayer[], direction: 'ENTRADA' | 'SALIDA', quantity: number, unitCost?: number) {
    return FifoCostEngine.calculate({ layers, movementDirection: direction, quantity, unitCost });
  }

  /**
   * Obtiene la configuración actual del método de costeo y métricas del inventario.
   */
  async getCostConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ruc: true,
        legal_name: true,
        trade_name: true,
        inventory_cost_method: true,
        updated_at: true,
      },
    });

    const [productsCount, warehousesCount, movementsCount, balances] = await Promise.all([
      this.prisma.inventoryProduct.count({
        where: { company_id: companyId, is_active: true },
      }),
      this.prisma.inventoryWarehouse.count({
        where: { company_id: companyId },
      }),
      this.prisma.inventoryMovement.count({
        where: { company_id: companyId, archived_at: null },
      }),
      this.prisma.inventoryBalance.findMany({
        where: { company_id: companyId },
        select: { total_inventory_value: true },
      }),
    ]);

    const totalValuationPen = balances.reduce(
      (acc, b) => acc + Number(b.total_inventory_value || 0),
      0,
    );

    return {
      currentMethod: (company?.inventory_cost_method === 'FIFO' ? 'FIFO' : 'PROMEDIO') as 'PROMEDIO' | 'FIFO',
      companyRuc: company?.ruc || '',
      companyName: company?.legal_name || company?.trade_name || '',
      productsCount,
      warehousesCount,
      movementsCount,
      totalInventoryValuePen: r2(totalValuationPen),
      lastRecalculatedAt: company?.updated_at?.toISOString() || null,
    };
  }

  /**
   * Actualiza el método de costeo preferido de la empresa.
   */
  async updateCostMethod(companyId: string, method: 'PROMEDIO' | 'FIFO') {
    if (method !== 'PROMEDIO' && method !== 'FIFO') {
      throw new BadRequestException('Método de costeo inválido. Debe ser PROMEDIO o FIFO.');
    }
    await this.prisma.company.update({
      where: { id: companyId },
      data: { inventory_cost_method: method },
    });
    return {
      success: true,
      method,
      message: `Método de valuación actualizado a ${
        method === 'FIFO' ? 'PEPS (Primeras Entradas, Primeras Salidas)' : 'Costo Promedio Ponderado Móvil'
      }. Se recomienda ejecutar un recálculo de costeo.`,
    };
  }

  /**
   * Ejecuta el recálculo integral de costos y saldos para todos los productos y almacenes.
   * Reproduce cronológicamente los movimientos valorizados recalculando según el método especificado.
   */
  async recalculateCosting(companyId: string, targetMethod?: 'PROMEDIO' | 'FIFO') {
    const method = targetMethod ?? (await this.metodo(companyId));
    if (method !== 'PROMEDIO' && method !== 'FIFO') {
      throw new BadRequestException('Método de costeo inválido. Debe ser PROMEDIO o FIFO.');
    }

    if (targetMethod) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { inventory_cost_method: targetMethod },
      });
    }

    // Valuación previa total
    const initialBalances = await this.prisma.inventoryBalance.findMany({
      where: { company_id: companyId },
      select: { total_inventory_value: true },
    });
    const previousValuationPen = r2(
      initialBalances.reduce((acc, b) => acc + Number(b.total_inventory_value || 0), 0),
    );

    // Obtener todos los movimientos de la empresa ordenados cronológicamente
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { company_id: companyId, archived_at: null },
      orderBy: [{ movement_date: 'asc' }, { created_at: 'asc' }],
      select: {
        id: true,
        warehouse_id: true,
        product_id: true,
        direction: true,
        quantity: true,
        unit_cost: true,
        total_cost: true,
        movement_date: true,
      },
    });

    const groupedMovements = new Map<string, typeof movements>();
    for (const mov of movements) {
      const key = `${mov.warehouse_id}:${mov.product_id}`;
      const list = groupedMovements.get(key) ?? [];
      list.push(mov);
      groupedMovements.set(key, list);
    }

    let movementsProcessed = 0;
    const uniqueProducts = new Set<string>();

    for (const [key, group] of groupedMovements.entries()) {
      const [warehouseId, productId] = key.split(':');
      uniqueProducts.add(productId);

      if (method === 'PROMEDIO') {
        let runningStock = 0;
        let runningCost = 0;
        let runningTotalValue = 0;
        let lastMovementDate: Date | null = null;

        for (const mov of group) {
          const qty = r4(Number(mov.quantity));
          const originalUnitCost = r4(Number(mov.unit_cost));
          lastMovementDate = mov.movement_date;

          let calcUnitCost = originalUnitCost;
          let calcTotalCost = r2(qty * originalUnitCost);
          let resultingStock = runningStock;
          let resultingCost = runningCost;
          let resultingValue = runningTotalValue;

          if (mov.direction === 'ENTRADA') {
            const calc = MovingWeightedAverageEngine.calculate({
              previousStock: runningStock,
              previousAverageCost: runningCost,
              previousTotalValue: runningTotalValue,
              movementDirection: 'ENTRADA',
              quantity: qty,
              unitCost: originalUnitCost,
            });
            calcUnitCost = calc.movementUnitCost;
            calcTotalCost = calc.movementTotalCost;
            resultingStock = calc.resultingStock;
            resultingCost = calc.resultingAverageCost;
            resultingValue = calc.resultingTotalValue;
          } else {
            // SALIDA
            if (runningStock > 0) {
              const outQty = Math.min(qty, runningStock);
              const calc = MovingWeightedAverageEngine.calculate({
                previousStock: runningStock,
                previousAverageCost: runningCost,
                previousTotalValue: runningTotalValue,
                movementDirection: 'SALIDA',
                quantity: outQty,
              });
              calcUnitCost = calc.movementUnitCost;
              calcTotalCost = calc.movementTotalCost;
              resultingStock = calc.resultingStock;
              resultingCost = calc.resultingAverageCost;
              resultingValue = calc.resultingTotalValue;
            } else {
              calcUnitCost = 0;
              calcTotalCost = 0;
              resultingStock = r4(runningStock - qty);
              resultingCost = 0;
              resultingValue = 0;
            }
          }

          await this.prisma.inventoryMovement.update({
            where: { id: mov.id },
            data: {
              unit_cost: calcUnitCost,
              total_cost: calcTotalCost,
              previous_stock: runningStock,
              previous_unit_cost: runningCost,
              previous_total_value: runningTotalValue,
              resulting_stock: resultingStock,
              resulting_unit_cost: resultingCost,
              resulting_total_value: resultingValue,
            },
          });

          runningStock = resultingStock;
          runningCost = resultingCost;
          runningTotalValue = resultingValue;
          movementsProcessed++;
        }

        await this.prisma.inventoryBalance.upsert({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouseId,
              product_id: productId,
            },
          },
          create: {
            company_id: companyId,
            warehouse_id: warehouseId,
            product_id: productId,
            current_stock: runningStock,
            average_unit_cost: runningCost,
            total_inventory_value: runningTotalValue,
            last_movement_at: lastMovementDate,
          },
          update: {
            current_stock: runningStock,
            average_unit_cost: runningCost,
            total_inventory_value: runningTotalValue,
            last_movement_at: lastMovementDate,
          },
        });
      } else {
        // FIFO
        await this.prisma.inventoryCostLayer.deleteMany({
          where: {
            company_id: companyId,
            warehouse_id: warehouseId,
            product_id: productId,
          },
        });

        let layers: CostLayer[] = [];
        let runningStock = 0;
        let runningCost = 0;
        let runningTotalValue = 0;
        let lastMovementDate: Date | null = null;

        for (const mov of group) {
          const qty = r4(Number(mov.quantity));
          const originalUnitCost = r4(Number(mov.unit_cost));
          lastMovementDate = mov.movement_date;

          let calcUnitCost = originalUnitCost;
          let calcTotalCost = r2(qty * originalUnitCost);
          let resultingStock = runningStock;
          let resultingCost = runningCost;
          let resultingValue = runningTotalValue;

          if (mov.direction === 'ENTRADA') {
            const r = FifoCostEngine.calculate({
              layers,
              movementDirection: 'ENTRADA',
              quantity: qty,
              unitCost: originalUnitCost,
            });
            layers = r.layers;
            calcUnitCost = r.movementUnitCost;
            calcTotalCost = r.movementTotalCost;
            resultingStock = r.resultingStock;
            resultingCost = r.resultingAverageCost;
            resultingValue = r.resultingTotalValue;
          } else {
            // SALIDA
            if (layers.length > 0) {
              const avail = layers.reduce((s, l) => s + l.quantity, 0);
              const consumeQty = Math.min(qty, avail);
              if (consumeQty > 0) {
                const r = FifoCostEngine.calculate({
                  layers,
                  movementDirection: 'SALIDA',
                  quantity: consumeQty,
                });
                layers = r.layers;
                calcUnitCost = r.movementUnitCost;
                calcTotalCost = r.movementTotalCost;
                resultingStock = r.resultingStock;
                resultingCost = r.resultingAverageCost;
                resultingValue = r.resultingTotalValue;
              }
            } else {
              calcUnitCost = 0;
              calcTotalCost = 0;
              resultingStock = r4(runningStock - qty);
              resultingCost = 0;
              resultingValue = 0;
            }
          }

          await this.prisma.inventoryMovement.update({
            where: { id: mov.id },
            data: {
              unit_cost: calcUnitCost,
              total_cost: calcTotalCost,
              previous_stock: runningStock,
              previous_unit_cost: runningCost,
              previous_total_value: runningTotalValue,
              resulting_stock: resultingStock,
              resulting_unit_cost: resultingCost,
              resulting_total_value: resultingValue,
            },
          });

          runningStock = resultingStock;
          runningCost = resultingCost;
          runningTotalValue = resultingValue;
          movementsProcessed++;
        }

        for (const layer of layers) {
          if (layer.quantity > 0) {
            await this.prisma.inventoryCostLayer.create({
              data: {
                company_id: companyId,
                warehouse_id: warehouseId,
                product_id: productId,
                quantity_remaining: layer.quantity,
                unit_cost: layer.unitCost,
              },
            });
          }
        }

        await this.prisma.inventoryBalance.upsert({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouseId,
              product_id: productId,
            },
          },
          create: {
            company_id: companyId,
            warehouse_id: warehouseId,
            product_id: productId,
            current_stock: runningStock,
            average_unit_cost: runningCost,
            total_inventory_value: runningTotalValue,
            last_movement_at: lastMovementDate,
          },
          update: {
            current_stock: runningStock,
            average_unit_cost: runningCost,
            total_inventory_value: runningTotalValue,
            last_movement_at: lastMovementDate,
          },
        });
      }
    }

    const finalBalances = await this.prisma.inventoryBalance.findMany({
      where: { company_id: companyId },
      select: { total_inventory_value: true },
    });
    const newValuationPen = r2(
      finalBalances.reduce((acc, b) => acc + Number(b.total_inventory_value || 0), 0),
    );

    return {
      success: true,
      method,
      productsCount: uniqueProducts.size,
      movementsCount: movementsProcessed,
      previousValuationPen,
      newValuationPen,
      differencePen: r2(newValuationPen - previousValuationPen),
      recalculatedAt: new Date().toISOString(),
    };
  }
}
