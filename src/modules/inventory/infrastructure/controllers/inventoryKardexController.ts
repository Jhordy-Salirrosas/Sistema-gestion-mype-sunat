import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryKardexService } from '../../application/services/inventoryKardexService';
import { InventoryCostLayerService } from '../../application/services/inventoryCostLayerService';
import {
  RecalculateCostingDto,
  UpdateCostMethodDto,
} from '../../application/dto/costConfigDto';

@Controller('api/v1/inventory/kardex')
@UseGuards(AuthGuard)
export class InventoryKardexController {
  constructor(
    private readonly kardex: InventoryKardexService,
    private readonly costLayers: InventoryCostLayerService,
  ) {}

  @Get()
  getKardex(
    @CurrentCompany() companyId: string | undefined,
    @Query('sku') sku?: string,
    @Query('warehouse') warehouse?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('operation') operation?: string,
    @Query('document') document?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.kardex.getKardex(companyId, {
      sku,
      warehouse,
      startDate,
      endDate,
      operation,
      document,
    });
  }

  @Get('cash')
  getCashAndBanks(
    @CurrentCompany() companyId: string | undefined,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('direction') direction?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.kardex.getCashAndBanks(companyId, {
      startDate,
      endDate,
      direction,
    });
  }

  @Get('consolidated')
  getConsolidated(@CurrentCompany() companyId: string | undefined) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.kardex.getConsolidated(companyId);
  }

  @Get('config')
  getCostConfig(@CurrentCompany() companyId: string | undefined) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.costLayers.getCostConfig(companyId);
  }

  @Post('config/method')
  @HttpCode(HttpStatus.OK)
  updateCostMethod(
    @CurrentCompany() companyId: string | undefined,
    @Body() body: UpdateCostMethodDto,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.costLayers.updateCostMethod(companyId, body?.method);
  }

  @Post('config/recalculate')
  @HttpCode(HttpStatus.OK)
  recalculateCosting(
    @CurrentCompany() companyId: string | undefined,
    @Body() body: RecalculateCostingDto,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.costLayers.recalculateCosting(companyId, body?.method);
  }
}
