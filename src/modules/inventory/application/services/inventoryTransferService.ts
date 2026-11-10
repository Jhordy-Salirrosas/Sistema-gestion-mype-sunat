import { Logger } from '@nestjs/common';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import {
  CreateAdjustmentDto,
  CreateTransferDto,
} from '../dto/inventoryTransferDto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Transferencias y ajustes de inventario.
 *
 * Escribe el libro `inventory_movements` en una sola transacción por operación.
 * No modifica facturación ni contabilidad: solo deja el movimiento de stock.
 */
@Injectable()
export class InventoryTransferService {
  private readonly logger = new Logger(InventoryTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting?: GenerateAccountingEntryUseCase,
  ) {}

  listTransfers(companyId: string) {
    return this.prisma.inventoryTransfer.findMany({
      where: { company_id: companyId },
      include: { items: true },
      orderBy: { transfer_date: 'desc' },
      take: 200,
    });
  }

  listAdjustments(companyId: string) {
    return this.prisma.inventoryAdjustment.findMany({
      where: { company_id: companyId },
      include: { items: true },
      orderBy: { adjustment_date: 'desc' },
      take: 200,
    });
  }

  async createTransfer(companyId: string, dto: CreateTransferDto) {
    const fromCode = dto.fromWarehouseCode.trim().toUpperCase();
    const toCode = dto.toWarehouseCode.trim().toUpperCase();
    if (fromCode === toCode) {
      throw new BadRequestException('El almacén de origen y destino deben ser distintos.');
    }

    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo SKU en una transferencia.');
    }

    const transferNumber =
      dto.transferNumber?.trim().toUpperCase() || `TRF-${Date.now().toString().slice(-8)}`;
    const transferDate = dto.transferDate ? new Date(dto.transferDate) : new Date();

    const duplicate = await this.prisma.inventoryTransfer.findFirst({
      where: { company_id: companyId, transfer_number: transferNumber },
    });
    if (duplicate) throw new ConflictException('Ya existe una transferencia con ese número.');

    return this.prisma.$transaction(async (tx: any) => {
      const from = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: fromCode },
      });
      const to = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: toCode },
      });
      if (!from) throw new NotFoundException(`Almacén de origen ${fromCode} no encontrado.`);
      if (!to) throw new NotFoundException(`Almacén de destino ${toCode} no encontrado.`);

      const itemRows: any[] = [];
      const movementRows: any[] = [];
      const balanceUpdates: any[] = [];

      for (const item of dto.items) {
        const sku = item.sku.trim().toUpperCase();
        const product = await tx.inventoryProduct.findFirst({
          where: { company_id: companyId, sku },
        });
        if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);
        if (!product.is_inventory) {
          throw new BadRequestException(`El producto ${sku} es un servicio y no mueve stock.`);
        }

        const origin = await tx.inventoryBalance.findUnique({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: from.id,
              product_id: product.id,
            },
          },
        });
        const originStock = Number(origin?.current_stock ?? 0);
        if (originStock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente de ${sku}: disponible ${originStock}, solicitado ${item.quantity}.`,
          );
        }

        const originCost = Number(origin?.average_unit_cost ?? 0);
        const outCalc = MovingWeightedAverageEngine.calculate({
          previousStock: originStock,
          previousAverageCost: originCost,
          previousTotalValue: Number(origin?.total_inventory_value ?? 0),
          movementDirection: 'SALIDA',
          quantity: item.quantity,
          unitCost: originCost,
        });

        const destination = await tx.inventoryBalance.findUnique({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: to.id,
              product_id: product.id,
            },
          },
        });
        const inCalc = MovingWeightedAverageEngine.calculate({
          previousStock: Number(destination?.current_stock ?? 0),
          previousAverageCost: Number(destination?.average_unit_cost ?? 0),
          previousTotalValue: Number(destination?.total_inventory_value ?? 0),
          movementDirection: 'ENTRADA',
          quantity: item.quantity,
          unitCost: outCalc.movementUnitCost,
        });

        itemRows.push({
          product_id: product.id,
          sku,
          description: product.description,
          quantity: item.quantity,
          unit_cost: r4(outCalc.movementUnitCost),
          total_cost: r2(outCalc.movementTotalCost),
        });

        movementRows.push(
          this.movementData({
            companyId,
            warehouseId: from.id,
            productId: product.id,
            movementNumber: `${transferNumber}-OUT-${sku}`,
            movementDate: transferDate,
            operationTypeCode: '22',
            direction: 'SALIDA',
            calc: outCalc,
            previousStock: originStock,
            previousAverageCost: originCost,
            previousTotalValue: Number(origin?.total_inventory_value ?? 0),
            sourceReferenceId: transferNumber,
            documentNumber: transferNumber,
            notes: `Transferencia ${transferNumber}: salida de ${fromCode}`,
          }),
          this.movementData({
            companyId,
            warehouseId: to.id,
            productId: product.id,
            movementNumber: `${transferNumber}-IN-${sku}`,
            movementDate: transferDate,
            operationTypeCode: '21',
            direction: 'ENTRADA',
            calc: inCalc,
            previousStock: Number(destination?.current_stock ?? 0),
            previousAverageCost: Number(destination?.average_unit_cost ?? 0),
            previousTotalValue: Number(destination?.total_inventory_value ?? 0),
            sourceReferenceId: transferNumber,
            documentNumber: transferNumber,
            notes: `Transferencia ${transferNumber}: ingreso a ${toCode}`,
          }),
        );

        balanceUpdates.push(
          { warehouseId: from.id, productId: product.id, calc: outCalc, date: transferDate },
          { warehouseId: to.id, productId: product.id, calc: inCalc, date: transferDate },
        );
      }

      const transfer = await tx.inventoryTransfer.create({
        data: {
          company_id: companyId,
          transfer_number: transferNumber,
          transfer_date: transferDate,
          from_warehouse_code: fromCode,
          to_warehouse_code: toCode,
          status: 'CONFIRMADA',
          responsible: dto.responsible ?? null,
          notes: dto.notes ?? null,
          items: { create: itemRows },
        },
        include: { items: true },
      });

      for (const movement of movementRows) {
        await tx.inventoryMovement.create({ data: movement });
      }

      for (const update of balanceUpdates) {
        await this.upsertBalance(tx, companyId, update.warehouseId, update.productId, update.calc, update.date);
      }

      const items = transfer.items ?? [];
      const valor = items.reduce((acc: number, item: { total_cost: unknown }) => acc + Number(item.total_cost), 0);
      await this.registrarAsientoTransferencia(companyId, transfer, valor);
      return transfer;
    });
  }

  /** Asiento interno: debita almacén destino y acredita almacén origen. */
  private async registrarAsientoTransferencia(
    companyId: string,
    transfer: { id: string; transfer_number: string; transfer_date: Date; from_warehouse_code: string; to_warehouse_code: string; items?: { total_cost: unknown }[] },
    valor: number,
  ): Promise<void> {
    if (!this.accounting || valor <= 0) return;
    try {
      const existente = await this.prisma.accountingEntry.findFirst({
        where: { company_id: companyId, source_reference_id: transfer.id },
      });
      if (existente) return;

      const mappings = (await (this.prisma as any).accountingMapping?.findMany({
        where: { company_id: companyId, process_code: 'TRANSFERENCIA', is_active: true },
      })) ?? [];
      const roles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
      const cuentaDestino = roles.get('ALMACEN_DESTINO') || '20111.02';
      const cuentaOrigen = roles.get('ALMACEN_ORIGEN') || '20111.01';

      await this.accounting.execute({
        companyId,
        period: transfer.transfer_date.toISOString().slice(0, 7),
        entryDate: transfer.transfer_date.toISOString().slice(0, 10),
        glosa: `Transferencia ${transfer.transfer_number}: ${transfer.from_warehouse_code} -> ${transfer.to_warehouse_code}`,
        sourceModule: 'INVENTORY',
        sourceReferenceId: transfer.id,
        idempotencyKey: `transfer:${transfer.id}`,
        lines: [
          {
            lineOrder: 1,
            accountCode: cuentaDestino,
            accountName: `Mercaderías Almacén ${transfer.to_warehouse_code}`,
            debitAmount: valor,
            creditAmount: 0,
          },
          {
            lineOrder: 2,
            accountCode: cuentaOrigen,
            accountName: `Mercaderías Almacén ${transfer.from_warehouse_code}`,
            debitAmount: 0,
            creditAmount: valor,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Transferencia ${transfer.transfer_number} sin asiento: ${(error as Error).message}`,
      );
    }
  }

  async createAdjustment(companyId: string, dto: CreateAdjustmentDto) {
    const warehouseCode = dto.warehouseCode.trim().toUpperCase();
    const adjustmentNumber =
      dto.adjustmentNumber?.trim().toUpperCase() || `AJU-${Date.now().toString().slice(-8)}`;
    const adjustmentDate = dto.adjustmentDate ? new Date(dto.adjustmentDate) : new Date();

    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo SKU en un ajuste.');
    }

    const duplicate = await this.prisma.inventoryAdjustment.findFirst({
      where: { company_id: companyId, adjustment_number: adjustmentNumber },
    });
    if (duplicate) throw new ConflictException('Ya existe un ajuste con ese número.');

    const result = await this.prisma.$transaction(async (tx: any) => {
      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: warehouseCode },
      });
      if (!warehouse) throw new NotFoundException(`Almacén ${warehouseCode} no encontrado.`);

      const itemRows: any[] = [];
      const movementRows: any[] = [];
      const balanceUpdates: any[] = [];

      for (const item of dto.items) {
        const sku = item.sku.trim().toUpperCase();
        const product = await tx.inventoryProduct.findFirst({
          where: { company_id: companyId, sku },
        });
        if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);
        if (!product.is_inventory) {
          throw new BadRequestException(`El producto ${sku} es un servicio y no mueve stock.`);
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
        const currentStock = Number(balance?.current_stock ?? 0);
        const currentCost = Number(balance?.average_unit_cost ?? 0);

        if (dto.type === 'SALIDA' && currentStock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente de ${sku}: disponible ${currentStock}, solicitado ${item.quantity}.`,
          );
        }

        const fallbackCost = currentCost > 0 ? currentCost : Number((product as any).cost_price || 0);
        const unitCost = dto.type === 'ENTRADA'
          ? (item.unitCost && item.unitCost > 0 ? Number(item.unitCost) : fallbackCost)
          : currentCost;
        const calc = MovingWeightedAverageEngine.calculate({
          previousStock: currentStock,
          previousAverageCost: currentCost,
          previousTotalValue: Number(balance?.total_inventory_value ?? 0),
          movementDirection: dto.type,
          quantity: item.quantity,
          unitCost,
        });

        const counted = dto.type === 'ENTRADA'
          ? currentStock + item.quantity
          : currentStock - item.quantity;

        itemRows.push({
          product_id: product.id,
          sku,
          description: product.description,
          system_quantity: currentStock,
          counted_quantity: counted,
          difference_quantity: dto.type === 'ENTRADA' ? item.quantity : -item.quantity,
          unit_cost: r4(unitCost),
        });

        movementRows.push(
          this.movementData({
            companyId,
            warehouseId: warehouse.id,
            productId: product.id,
            movementNumber: `${adjustmentNumber}-${sku}`,
            movementDate: adjustmentDate,
            operationTypeCode: '28',
            direction: dto.type,
            calc,
            previousStock: currentStock,
            previousAverageCost: currentCost,
            previousTotalValue: Number(balance?.total_inventory_value ?? 0),
            sourceReferenceId: adjustmentNumber,
            documentNumber: adjustmentNumber,
            notes: `Ajuste ${adjustmentNumber}: ${dto.reason}`,
          }),
        );
        balanceUpdates.push({
          warehouseId: warehouse.id,
          productId: product.id,
          calc,
          date: adjustmentDate,
        });
      }

      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          company_id: companyId,
          adjustment_number: adjustmentNumber,
          adjustment_date: adjustmentDate,
          warehouse_code: warehouseCode,
          type: dto.type,
          reason: dto.reason,
          status: 'APLICADO',
          responsible: dto.responsible ?? null,
          notes: dto.notes ?? null,
          items: { create: itemRows },
        },
        include: { items: true },
      });

      for (const movement of movementRows) {
        await tx.inventoryMovement.create({ data: movement });
      }
      for (const update of balanceUpdates) {
        await this.upsertBalance(tx, companyId, update.warehouseId, update.productId, update.calc, update.date);
      }

      return {
        adjustment,
        totalValue: r2(itemRows.reduce((acc: number, i: any) => acc + Number(i.total_cost || 0), 0)),
      };
    });

    await this.registrarAsientoAjuste(companyId, result.adjustment, result.totalValue);
    return result.adjustment;
  }

  /** Asiento por ajuste: merma/faltante (debe 659 / haber 201) o sobrante (debe 201 / haber 759). */
  private async registrarAsientoAjuste(
    companyId: string,
    adjustment: { id: string; adjustment_number: string; adjustment_date: Date; warehouse_code: string; reason?: string | null; type: 'ENTRADA' | 'SALIDA' },
    valor: number,
  ): Promise<void> {
    if (!this.accounting || valor <= 0) return;
    try {
      const existente = await this.prisma.accountingEntry.findFirst({
        where: { company_id: companyId, source_reference_id: adjustment.id },
      });
      if (existente) return;

      const mappings = (await (this.prisma as any).accountingMapping?.findMany({
        where: { company_id: companyId, process_code: 'INVENTARIO', is_active: true },
      })) ?? [];
      const roles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
      const cuentaExistencias = roles.get('MERCADERIAS') || '201';
      const cuentaGastoMerma = roles.get('GASTO_MERMA') || '659';
      const cuentaIngresoSobrante = roles.get('INGRESO_SOBRANTE') || '759';

      const lines = adjustment.type === 'SALIDA'
        ? [
            {
              lineOrder: 1,
              accountCode: cuentaGastoMerma,
              accountName: 'Otros gastos de gestión (Pérdidas de inventario/Merma)',
              debitAmount: valor,
              creditAmount: 0,
            },
            {
              lineOrder: 2,
              accountCode: cuentaExistencias,
              accountName: `Mercaderías Almacén ${adjustment.warehouse_code}`,
              debitAmount: 0,
              creditAmount: valor,
            },
          ]
        : [
            {
              lineOrder: 1,
              accountCode: cuentaExistencias,
              accountName: `Mercaderías Almacén ${adjustment.warehouse_code}`,
              debitAmount: valor,
              creditAmount: 0,
            },
            {
              lineOrder: 2,
              accountCode: cuentaIngresoSobrante,
              accountName: 'Otros ingresos de gestión (Sobrantes de inventario)',
              debitAmount: 0,
              creditAmount: valor,
            },
          ];

      await this.accounting.execute({
        companyId,
        period: adjustment.adjustment_date.toISOString().slice(0, 7),
        entryDate: adjustment.adjustment_date.toISOString().slice(0, 10),
        glosa: `Ajuste ${adjustment.adjustment_number} (${adjustment.reason || adjustment.type}): Almacén ${adjustment.warehouse_code}`,
        sourceModule: 'INVENTORY',
        sourceReferenceId: adjustment.id,
        idempotencyKey: `adjustment:${adjustment.id}`,
        lines,
      });
    } catch (error) {
      this.logger.warn(
        `Ajuste ${adjustment.adjustment_number} sin asiento: ${(error as Error).message}`,
      );
    }
  }

  private movementData(params: {
    companyId: string;
    warehouseId: string;
    productId: string;
    movementNumber: string;
    movementDate: Date;
    operationTypeCode: string;
    direction: 'ENTRADA' | 'SALIDA';
    calc: ReturnType<typeof MovingWeightedAverageEngine.calculate>;
    previousStock: number;
    previousAverageCost: number;
    previousTotalValue: number;
    sourceReferenceId: string;
    documentNumber: string;
    notes: string;
  }) {
    return {
      company_id: params.companyId,
      warehouse_id: params.warehouseId,
      product_id: params.productId,
      movement_number: params.movementNumber,
      movement_date: params.movementDate,
      accounting_date: params.movementDate,
      operation_type_code: params.operationTypeCode,
      document_type_code: '00',
      document_serial: 'INT',
      document_number: params.documentNumber,
      direction: params.direction,
      quantity: params.calc.movementQuantity,
      unit_cost: r4(params.calc.movementUnitCost),
      total_cost: r2(params.calc.movementTotalCost),
      previous_stock: r4(params.previousStock),
      previous_unit_cost: r4(params.previousAverageCost),
      previous_total_value: r2(params.previousTotalValue),
      resulting_stock: params.calc.resultingStock,
      resulting_unit_cost: r4(params.calc.resultingAverageCost),
      resulting_total_value: r2(params.calc.resultingTotalValue),
      source_reference_id: params.sourceReferenceId,
      source_module: 'INVENTORY',
      notes: params.notes,
    };
  }

  private async upsertBalance(
    tx: any,
    companyId: string,
    warehouseId: string,
    productId: string,
    calc: ReturnType<typeof MovingWeightedAverageEngine.calculate>,
    date: Date,
  ) {
    await tx.inventoryBalance.upsert({
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
        current_stock: calc.resultingStock,
        average_unit_cost: r4(calc.resultingAverageCost),
        total_inventory_value: r2(calc.resultingTotalValue),
        last_movement_at: date,
      },
      update: {
        current_stock: calc.resultingStock,
        average_unit_cost: r4(calc.resultingAverageCost),
        total_inventory_value: r2(calc.resultingTotalValue),
        last_movement_at: date,
      },
    });
  }
}
