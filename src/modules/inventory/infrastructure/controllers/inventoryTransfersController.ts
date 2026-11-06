import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryTransferService } from '../../application/services/inventoryTransferService';
import {
  CreateAdjustmentDto,
  CreateTransferDto,
} from '../../application/dto/inventoryTransferDto';

@Controller('api/v1/inventory/transfers')
@UseGuards(AuthGuard)
export class InventoryTransfersController {
  constructor(private readonly transfers: InventoryTransferService) {}

  @Get()
  list(@CurrentCompany() companyId?: string) {
    return this.transfers.listTransfers(this.requireCompany(companyId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTransferDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.transfers.createTransfer(this.requireCompany(companyId), dto);
  }

  private requireCompany(companyId?: string): string {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return companyId;
  }
}

@Controller('api/v1/inventory/adjustments')
@UseGuards(AuthGuard)
export class InventoryAdjustmentsController {
  constructor(private readonly adjustments: InventoryTransferService) {}

  @Get()
  list(@CurrentCompany() companyId?: string) {
    return this.adjustments.listAdjustments(this.requireCompany(companyId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateAdjustmentDto,
    @CurrentCompany() companyId?: string,
  ) {
    return this.adjustments.createAdjustment(this.requireCompany(companyId), dto);
  }

  private requireCompany(companyId?: string): string {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return companyId;
  }
}
