import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import { CreateOpeningDto } from '../dto/inventoryOpeningDto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Carga de saldo inicial. Genera movimientos tipo 16 y actualiza saldos.
 * No crea una tabla de cabecera: el libro es la fuente de verdad.
 */
@Injectable()
export class InventoryOpeningService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateOpeningDto) {
    const warehouseCode = (dto.warehouseCode ?? 'ALM-01').trim().toUpperCase();
    const openingDate = dto.openingDate ? new Date(dto.openingDate) : new Date();
    const dateKey = openingDate.toISOString().slice(0, 10);

    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo SKU en el saldo inicial.');
    }

    const empresa = await (this.prisma as any).company?.findUnique?.({
      where: { id: companyId },
      select: { inventory_cost_method: true },
    });
    const usaFifo = empresa?.inventory_cost_method === 'FIFO';

    return this.prisma.$transaction(async (tx: any) => {
      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: warehouseCode },
      });
      if (!warehouse) throw new NotFoundException(`Almacén ${warehouseCode} no encontrado.`);

      const resultItems: any[] = [];

      for (const item of dto.items) {
        const sku = item.sku.trim().toUpperCase();
        const product = await tx.inventoryProduct.findFirst({
          where: { company_id: companyId, sku },
        });
        if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);
        if (!product.is_inventory) {
          throw new BadRequestException(`El producto ${sku} es un servicio y no mueve stock.`);
        }

        const sourceReferenceId = `OPENING-${dateKey}-${sku}`;
        const duplicate = await tx.inventoryMovement.findFirst({
          where: {
            company_id: companyId,
            product_id: product.id,
            operation_type_code: '16',
            source_reference_id: sourceReferenceId,
          },
        });
        if (duplicate) {
          throw new ConflictException(
            `Ya existe un saldo inicial para ${sku} con fecha ${dateKey}.`,
          );
        }

        const balance = await tx.inventoryBalance.findUnique({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
            },
          },
        });

        const calc = MovingWeightedAverageEngine.calculate({
          previousStock: Number(balance?.current_stock ?? 0),
          previousAverageCost: Number(balance?.average_unit_cost ?? 0),
          previousTotalValue: Number(balance?.total_inventory_value ?? 0),
          movementDirection: 'ENTRADA',
          quantity: item.quantity,
          unitCost: item.unitCost,
        });

        await tx.inventoryMovement.create({
          data: {
            company_id: companyId,
            warehouse_id: warehouse.id,
            product_id: product.id,
            movement_number: `OPEN-${dateKey}-${sku}`,
            movement_date: openingDate,
            accounting_date: openingDate,
            operation_type_code: '16',
            document_type_code: '00',
            document_serial: 'SI',
            document_number: dateKey,
            direction: 'ENTRADA',
            quantity: calc.movementQuantity,
            unit_cost: r4(calc.movementUnitCost),
            total_cost: r2(calc.movementTotalCost),
            previous_stock: r4(Number(balance?.current_stock ?? 0)),
            previous_unit_cost: r4(Number(balance?.average_unit_cost ?? 0)),
            previous_total_value: r2(Number(balance?.total_inventory_value ?? 0)),
            resulting_stock: calc.resultingStock,
            resulting_unit_cost: r4(calc.resultingAverageCost),
            resulting_total_value: r2(calc.resultingTotalValue),
            source_reference_id: sourceReferenceId,
            source_module: 'MIGRATION',
            notes: dto.notes ?? `Saldo inicial ${dateKey}`,
          },
        });

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
            last_movement_at: openingDate,
          },
          update: {
            current_stock: calc.resultingStock,
            average_unit_cost: r4(calc.resultingAverageCost),
            total_inventory_value: r2(calc.resultingTotalValue),
            last_movement_at: openingDate,
          },
        });

        if (usaFifo && (tx as any).inventoryCostLayer?.create) {
          await (tx as any).inventoryCostLayer.create({
            data: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
              quantity_remaining: item.quantity,
              unit_cost: r4(calc.movementUnitCost),
            },
          });
        }

        resultItems.push({
          sku,
          description: product.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          resultingStock: calc.resultingStock,
          resultingAverageCost: calc.resultingAverageCost,
          resultingTotalValue: calc.resultingTotalValue,
        });
      }

      return {
        warehouseCode,
        openingDate: dateKey,
        items: resultItems,
      };
    });
  }
}
