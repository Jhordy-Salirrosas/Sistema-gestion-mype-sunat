import {
  Controller,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryKardexService } from '../../application/services/inventoryKardexService';

@Controller('api/v1/inventory/kardex')
@UseGuards(AuthGuard)
export class InventoryKardexController {
  constructor(private readonly kardex: InventoryKardexService) {}

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
}
