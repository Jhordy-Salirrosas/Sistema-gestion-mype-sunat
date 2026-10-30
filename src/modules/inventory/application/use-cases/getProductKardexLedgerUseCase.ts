import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class GetProductKardexLedgerUseCase {
  constructor(
    @Inject(INVENTORY_PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IInventoryProductRepositoryPort,
    @Inject(INVENTORY_MOVEMENT_REPOSITORY_PORT)
    private readonly movementRepository: IInventoryMovementRepositoryPort,
    @Inject(INVENTORY_BALANCE_REPOSITORY_PORT)
    private readonly balanceRepository: IInventoryBalanceRepositoryPort,
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

    return {
      product: {
        id: product.id,
        sku: product.sku,
        description: product.description,
        sunatTypeCode: product.sunatTypeCode,
        sunatUnitCode: product.sunatUnitCode,
      },
      movements: movements.map((m) => ({
        id: m.id,
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

