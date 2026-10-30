import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RegisterManualMovementUseCase } from '../../application/use-cases/registerManualMovementUseCase';
import { RegisterManualMovementDto } from '../../application/dto/registerManualMovementDto';
import {
  INVENTORY_MOVEMENT_REPOSITORY_PORT,
  type IInventoryMovementRepositoryPort,
} from '../../domain/ports/IInventoryMovementRepositoryPort';

@Controller('api/v1/inventory/movements')
@UseGuards(AuthGuard)
export class InventoryMovementsController {
  constructor(
    private readonly registerMovementUseCase: RegisterManualMovementUseCase,
    @Inject(INVENTORY_MOVEMENT_REPOSITORY_PORT)
    private readonly movementRepository: IInventoryMovementRepositoryPort,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMovement(
    @Body() dto: RegisterManualMovementDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.registerMovementUseCase.execute(dto, companyId);
  }

  @Get()
  async listMovements(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const movements = await this.movementRepository.findAllByCompany(
      companyId,
      start,
      end,
    );

    return {
      total: movements.length,
      items: movements.map((m) => ({
        id: m.id,
        warehouseCode: m.warehouseCode,
        sku: m.sku,
        description: m.productDescription,
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

