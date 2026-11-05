import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
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
import { PrismaService } from '../../../../database/prismaService';

@Controller('api/v1/inventory/stocks')
@UseGuards(AuthGuard)
export class InventoryStocksController {
  constructor(
    private readonly listStockUseCase: ListWarehouseStockUseCase,
    private readonly getKardexUseCase: GetProductKardexLedgerUseCase,
    @Inject(INVENTORY_PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IInventoryProductRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  @Get('warehouses')
  async listWarehouses(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.prisma.inventoryWarehouse.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { warehouse_code: 'asc' },
      select: { warehouse_code: true, description: true, sunat_establishment_code: true },
    });
  }

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

    const created = await this.prisma.inventoryProduct.create({
      data: {
        company_id: companyId,
        sku: dto.sku.trim().toUpperCase(),
        description: dto.description.trim(),
        sunat_type_code: dto.sunat_type_code || '01',
        sunat_unit_code: dto.sunat_unit_code || 'NIU',
        min_stock_alert: dto.min_stock_alert ?? 0,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        category: dto.category?.trim() || null,
        barcode: dto.barcode?.trim() || null,
        hs_code: dto.hs_code?.trim() || null,
        weight_kg: dto.weight_kg ?? null,
        volume_m3: dto.volume_m3 ?? null,
        tax_affectation: dto.tax_affectation?.trim() || '10',
      },
    });

    return created;
  }

  @Get('products/:sku')
  async getProductBySku(
    @Param('sku') sku: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
      include: {
        balances: {
          include: { warehouse: true },
        },
      },
    });
    if (!product) throw new NotFoundException(`Producto con SKU "${sku}" no encontrado.`);
    return product;
  }

  @Patch('products/:sku')
  async updateProduct(
    @Param('sku') sku: string,
    @Body() dto: Partial<RegisterProductDto>,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const existing = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!existing) throw new NotFoundException(`Producto con SKU "${sku}" no encontrado.`);

    return this.prisma.inventoryProduct.update({
      where: { id: existing.id },
      data: {
        description: dto.description?.trim(),
        sunat_type_code: dto.sunat_type_code,
        sunat_unit_code: dto.sunat_unit_code,
        min_stock_alert: dto.min_stock_alert,
        brand: dto.brand?.trim(),
        model: dto.model?.trim(),
        category: dto.category?.trim(),
        barcode: dto.barcode?.trim(),
        hs_code: dto.hs_code?.trim(),
        weight_kg: dto.weight_kg,
        volume_m3: dto.volume_m3,
        tax_affectation: dto.tax_affectation,
      },
    });
  }

  @Delete('products/:sku')
  async deleteProduct(
    @Param('sku') sku: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const existing = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!existing) throw new NotFoundException(`Producto con SKU "${sku}" no encontrado.`);

    // Verificar si registra movimientos en el kardex
    const movementCount = await this.prisma.inventoryMovement.count({
      where: {
        product_id: existing.id,
        company_id: companyId,
      },
    });

    if (movementCount > 0) {
      // Regla contable / NIC 2 / SUNAT: No se puede eliminar un producto con historial de movimientos.
      // En su lugar, se inactiva el producto para conservar la trazabilidad.
      await this.prisma.inventoryProduct.update({
        where: { id: existing.id },
        data: { is_active: false },
      });
      return {
        action: 'DEACTIVATED',
        message: `El producto "${sku}" tiene ${movementCount} movimiento(s) registrado(s) en el Kardex. Por trazabilidad tributaria (NIC 2 / SUNAT), no puede eliminarse físicamente; ha sido marcado como INACTIVO / DESCONTINUADO.`,
      };
    }

    // Si tiene 0 movimientos, eliminar saldos y el producto de forma segura
    await this.prisma.inventoryBalance.deleteMany({
      where: { product_id: existing.id, company_id: companyId },
    });
    await this.prisma.inventoryProduct.delete({
      where: { id: existing.id },
    });

    return {
      action: 'DELETED',
      message: `El producto "${sku}" ha sido eliminado exitosamente del catálogo y existencias.`,
    };
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

