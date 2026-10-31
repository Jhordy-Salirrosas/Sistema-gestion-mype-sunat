import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ListWarehouseStockUseCase } from '../../application/use-cases/listWarehouseStockUseCase';
import { GetProductKardexLedgerUseCase } from '../../application/use-cases/getProductKardexLedgerUseCase';
import { RegisterProductDto } from '../../application/dto/registerProductDto';
import {
  INVENTORY_PRODUCT_REPOSITORY_PORT,
  type IInventoryProductRepositoryPort,
} from '../../domain/ports/IInventoryProductRepositoryPort';
import { InventoryProductEntity } from '../../domain/entities/inventoryProductEntity';

@Controller('api/v1/inventory/stocks')
@UseGuards(AuthGuard)
export class InventoryStocksController {
  constructor(
    private readonly listStockUseCase: ListWarehouseStockUseCase,
    private readonly getKardexUseCase: GetProductKardexLedgerUseCase,
    @Inject(INVENTORY_PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IInventoryProductRepositoryPort,
  ) {}

  @Get()
  async listStock(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.listStockUseCase.execute(companyId);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  async registerProduct(
    @Body() dto: RegisterProductDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');

    const entity = new InventoryProductEntity({
      companyId,
      sku: dto.sku,
      description: dto.description,
      sunatTypeCode: dto.sunat_type_code,
      sunatUnitCode: dto.sunat_unit_code,
      minStockAlert: dto.min_stock_alert,
    });

    return this.productRepository.create(entity);
  }

  @Get('kardex/:sku')
  async getKardex(
    @Param('sku') sku: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.getKardexUseCase.execute(
      { sku, start_date: startDate, end_date: endDate },
      companyId,
    );
  }
}

