import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_BALANCE_REPOSITORY_PORT,
  type IInventoryBalanceRepositoryPort,
} from '../../domain/ports/IInventoryBalanceRepositoryPort';

@Injectable()
export class ListWarehouseStockUseCase {
  constructor(
    @Inject(INVENTORY_BALANCE_REPOSITORY_PORT)
    private readonly balanceRepository: IInventoryBalanceRepositoryPort,
  ) {}

  async execute(companyId: string) {
    if (!companyId) throw new BadRequestException('company_id requerido.');

    const balances = await this.balanceRepository.findAllByCompany(companyId);

    const totalStockValuation = balances.reduce(
      (sum, b) => sum + Number(b.totalInventoryValue || 0),
      0,
    );

    return {
      totalValuationPen: Number(totalStockValuation.toFixed(2)),
      totalItemsCount: balances.length,
      balances: balances.map((b) => ({
        id: b.id,
        warehouseCode: b.warehouseCode,
        sku: b.sku,
        description: b.productDescription,
        currentStock: b.currentStock,
        averageUnitCost: b.averageUnitCost,
        totalInventoryValue: b.totalInventoryValue,
        lastMovementAt: b.lastMovementAt,
      })),
    };
  }
}

