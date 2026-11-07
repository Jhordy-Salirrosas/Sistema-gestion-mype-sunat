import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  INVENTORY_PRODUCT_REPOSITORY_PORT,
  type IInventoryProductRepositoryPort,
} from '../../domain/ports/IInventoryProductRepositoryPort';
import {
  INVENTORY_MOVEMENT_REPOSITORY_PORT,
  type IInventoryMovementRepositoryPort,
} from '../../domain/ports/IInventoryMovementRepositoryPort';
import {
  INVENTORY_BALANCE_REPOSITORY_PORT,
  type IInventoryBalanceRepositoryPort,
} from '../../domain/ports/IInventoryBalanceRepositoryPort';
import { QueryKardexLedgerDto } from '../dto/queryKardexLedgerDto';
import { FifoCostEngine, type CostLayer } from '../../domain/rules/FifoCostEngine';

@Injectable()
export class GetProductKardexLedgerUseCase {
  constructor(
    @Inject(INVENTORY_PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IInventoryProductRepositoryPort,
    @Inject(INVENTORY_MOVEMENT_REPOSITORY_PORT)
    private readonly movementRepository: IInventoryMovementRepositoryPort,
    @Inject(INVENTORY_BALANCE_REPOSITORY_PORT)
    private readonly balanceRepository: IInventoryBalanceRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: QueryKardexLedgerDto, companyId: string) {
    if (!companyId) throw new BadRequestException('company_id requerido.');

    let product = null;
    if (query.product_id) {
      product = await this.productRepository.findById(query.product_id, companyId);
    } else if (query.sku) {
      product = await this.productRepository.findBySku(query.sku, companyId);
    }

    if (!product) {
      throw new NotFoundException('Producto no encontrado para el Kardex.');
    }

    const startDate = query.start_date ? new Date(query.start_date) : undefined;
    const endDate = query.end_date ? new Date(query.end_date) : undefined;

    const movements = await this.movementRepository.findMovementsByProduct(
      product.id!,
      companyId,
      startDate,
      endDate,
    );

    const balanceRows = await this.prisma.inventoryBalance.findMany({
      where: {
        product_id: product.id!,
        company_id: companyId,
      },
      include: {
        warehouse: true,
      },
    });

    const totalStock = balanceRows.reduce((acc, b) => acc + Number(b.current_stock), 0);
    const totalValuation = balanceRows.reduce((acc, b) => acc + Number(b.total_inventory_value), 0);
    const averageCost = totalStock > 0 ? totalValuation / totalStock : 0;

    const warehouseBalances = balanceRows.map((b) => ({
      warehouseCode: b.warehouse?.warehouse_code ?? 'ALM-01',
      warehouseDescription: b.warehouse?.description ?? 'Almacén Principal',
      stock: Number(b.current_stock),
      averageCost: Number(b.average_unit_cost),
      totalValue: Number(b.total_inventory_value),
    }));

    const metodo = query.metodo === 'FIFO' ? 'FIFO' : 'PROMEDIO';
    let capas: CostLayer[] = [];
    const movimientosCalculados = movements.map((m: any) => {
      if (metodo !== 'FIFO') return m;
      const resultado = FifoCostEngine.calculate({
        layers: capas,
        movementDirection: m.direction,
        quantity: Number(m.quantity),
        unitCost: Number(m.unitCost),
      });
      capas = resultado.layers;
      return {
        ...m,
        unitCost: resultado.movementUnitCost,
        totalCost: resultado.movementTotalCost,
        resultingStock: resultado.resultingStock,
        resultingUnitCost: resultado.resultingAverageCost,
        resultingTotalValue: resultado.resultingTotalValue,
      };
    });
    const fifoStock = capas.reduce((acc, c) => acc + c.quantity, 0);
    const fifoValue = capas.reduce((acc, c) => acc + c.quantity * c.unitCost, 0);
    const resumen = metodo === 'FIFO'
      ? { totalStock: fifoStock, averageCost: fifoStock > 0 ? fifoValue / fifoStock : 0, totalValuation: fifoValue, warehouseBalances }
      : { totalStock, averageCost, totalValuation, warehouseBalances };

    return {
      costMethod: metodo,
      product: {
        id: product.id,
        sku: product.sku,
        description: product.description,
        sunatTypeCode: product.sunatTypeCode,
        sunatUnitCode: product.sunatUnitCode,
      },
      summary: resumen,
      movements: movimientosCalculados.map((m: any) => ({
        id: m.id,
        warehouseCode: m.warehouseCode ?? 'ALM-01',
        movementNumber: m.movementNumber,
        movementDate: m.movementDate,
        operationTypeCode: m.operationTypeCode,
        documentTypeCode: m.documentTypeCode,
        documentSerial: m.documentSerial,
        documentNumber: m.documentNumber,
        direction: m.direction,
        quantity: m.quantity,
        unitCost: m.unitCost,
        totalCost: m.totalCost,
        previousStock: m.previousStock,
        resultingStock: m.resultingStock,
        resultingAverageCost: m.resultingUnitCost,
        resultingTotalValue: m.resultingTotalValue,
        sourceReferenceId: m.sourceReferenceId,
        notes: m.notes,
      })),
    };
  }
}

