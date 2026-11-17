import { InventoryCostLayerService } from './inventoryCostLayerService';
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
 * Carga de saldo inicial. Genera movimientos tipo 16, actualiza saldos
 * y genera el asiento contable de apertura (Libro Diario) según documento de sustento.
 */
@Injectable()
export class InventoryOpeningService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateOpeningDto) {
    const warehouseCode = (dto.warehouseCode ?? 'ALM-01').trim().toUpperCase();
    const openingDate = dto.openingDate ? new Date(dto.openingDate) : new Date();
    const dateKey = openingDate.toISOString().slice(0, 10);
    const period = dto.period?.trim() || dateKey.slice(0, 7);

    const docType = dto.documentTypeCode?.trim() || '00';
    const docSerial = dto.documentSerial?.trim().toUpperCase() || 'SI';
    const docNumber = dto.documentNumber?.trim().toUpperCase() || dateKey;

    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo SKU en el saldo inicial.');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Validar que el período contable no esté cerrado
      if (tx.accountingPeriod) {
        const periodRecord = await tx.accountingPeriod.findFirst({
          where: { company_id: companyId, period },
        });
        if (periodRecord && periodRecord.status === 'CERRADO') {
          throw new BadRequestException(
            `El período contable ${period} se encuentra CERRADO. No se pueden registrar saldos iniciales en un período cerrado.`,
          );
        }
      }

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

        await new InventoryCostLayerService(this.prisma).enTransaccion(tx).bloquear(companyId, warehouse.id, product.id);
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

        const noteText = dto.notes
          ? `${dto.notes}${dto.openingReason ? ` [${dto.openingReason}]` : ''}`
          : `Saldo inicial ${dto.openingReason ? `[${dto.openingReason}] ` : ''}Doc ${docType} ${docSerial}-${docNumber} Periodo ${period}`;

        const movimiento = await tx.inventoryMovement.create({
          data: {
            company_id: companyId,
            warehouse_id: warehouse.id,
            product_id: product.id,
            movement_number: `OPEN-${dateKey}-${sku}`,
            movement_date: openingDate,
            accounting_date: openingDate,
            operation_type_code: '16',
            document_type_code: docType,
            document_serial: docSerial,
            document_number: docNumber,
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
            notes: noteText,
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

        if (item.unitCost == null || !Number.isFinite(Number(item.unitCost))) {
          throw new BadRequestException(`Ingreso ${sku} sin costo acreditado.`);
        }

        await (tx as any).inventoryCostLayer.create({
          data: {
            company_id: companyId,
            warehouse_id: warehouse.id,
            product_id: product.id,
            quantity_remaining: item.quantity,
            unit_cost: r4(calc.movementUnitCost),
            source_movement_id: movimiento.id,
          },
        });

        resultItems.push({
          sku,
          description: product.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: r2(calc.movementTotalCost),
          resultingStock: calc.resultingStock,
          resultingAverageCost: calc.resultingAverageCost,
          resultingTotalValue: calc.resultingTotalValue,
        });
      }

      const batchTotalValue = r2(resultItems.reduce((acc, it) => acc + (it.totalCost || 0), 0));

      // 2. Generación automática del Asiento de Apertura en el Libro Diario
      let accountingEntryId: string | undefined;
      if (dto.generateAccountingEntry !== false && tx.accountingEntry && batchTotalValue > 0) {
        try {
          const lastEntry = await tx.accountingEntry.findFirst({
            where: { company_id: companyId, period },
            orderBy: { entry_number: 'desc' },
          });
          const nextEntryNumber = (lastEntry?.entry_number ?? 0) + 1;

          let contraAccount = '5011';
          let contraAccountName = 'Capital social - Aporte de bienes';
          if (dto.openingReason === 'LIQUIDACION_QUIEBRA') {
            contraAccount = '4699';
            contraAccountName = 'Otras cuentas por pagar diversas (Liquidación/Quiebra)';
          } else if (dto.openingReason === 'EJERCICIO_ANTERIOR') {
            contraAccount = '5911';
            contraAccountName = 'Utilidades no distribuidas (Arrastre de balance)';
          }

          const glosa = `Por el inventario inicial del período ${period} según Doc ${docType} ${docSerial}-${docNumber}${
            dto.notes ? ` · ${dto.notes}` : ''
          }`;

          const createdEntry = await tx.accountingEntry.create({
            data: {
              company_id: companyId,
              period,
              entry_number: nextEntryNumber,
              entry_date: openingDate,
              journal_code: 'APE',
              glosa,
              source_module: 'INVENTORY',
              source_reference_id: `OPENING-${docSerial}-${docNumber}`,
              idempotency_key: `OPENING-${companyId}-${period}-${docSerial}-${docNumber}-${dateKey}-${Date.now()}`,
              total_debit: batchTotalValue,
              total_credit: batchTotalValue,
              is_balanced: true,
              status: 'ASENTADO',
              lines: {
                create: [
                  {
                    line_order: 1,
                    account_code: '20111',
                    account_name: 'Mercaderías manufacturadas (Almacén)',
                    debit_amount: batchTotalValue,
                    credit_amount: 0,
                  },
                  {
                    line_order: 2,
                    account_code: contraAccount,
                    account_name: contraAccountName,
                    debit_amount: 0,
                    credit_amount: batchTotalValue,
                  },
                ],
              },
            },
          });
          accountingEntryId = createdEntry?.id;
        } catch (entryErr) {
          console.warn('No se pudo generar asiento contable de apertura automático:', entryErr);
        }
      }

      return {
        warehouseCode,
        openingDate: dateKey,
        period,
        document: {
          documentTypeCode: docType,
          documentSerial: docSerial,
          documentNumber: docNumber,
        },
        openingReason: dto.openingReason,
        accountingEntryId,
        batchTotalValue,
        items: resultItems,
      };
    });
  }
}
