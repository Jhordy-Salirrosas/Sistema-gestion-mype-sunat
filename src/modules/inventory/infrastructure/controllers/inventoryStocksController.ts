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
import {
  RegisterProductDto,
  ProductSupplierDto,
  ProductPresentationDto,
  ProductVariantDto,
} from '../../application/dto/registerProductDto';
import {
  INVENTORY_PRODUCT_REPOSITORY_PORT,
  type IInventoryProductRepositoryPort,
} from '../../domain/ports/IInventoryProductRepositoryPort';
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

    const sku = dto.sku.trim().toUpperCase();
    const unitCode = dto.sunat_unit_code?.trim() || 'NIU';
    const isService = dto.is_service ?? (dto.is_inventory !== undefined ? !dto.is_inventory : false);

    const created = await this.prisma.inventoryProduct.create({
      data: {
        company_id: companyId,
        sku,
        description: dto.description.trim(),
        origin_type: dto.origin_type || 'NACIONAL',
        is_service: isService,
        is_inventory: !isService,
        is_active: dto.is_active ?? true,
        sunat_type_code: dto.sunat_type_code || '01',
        sunat_unit_code: unitCode,
        min_stock_alert: dto.min_stock_alert ?? 0,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        category: dto.category?.trim() || null,
        manufacturer: dto.manufacturer?.trim() || null,
        country_of_origin: dto.country_of_origin?.trim().toUpperCase() || (dto.origin_type === 'IMPORTADO' ? 'CN' : 'PE'),
        tags: dto.tags || [],
        barcode: dto.barcode?.trim() || null,
        hs_code: dto.hs_code?.trim() || null,
        weight_kg: dto.weight_kg ?? null,
        volume_m3: dto.volume_m3 ?? null,
        tax_affectation: dto.tax_affectation?.trim() || '10',
        cost_price: dto.cost_price ?? null,
        sale_price: dto.sale_price ?? null,
        wholesale_price: dto.wholesale_price ?? null,
        promo_price: dto.promo_price ?? null,
        commission_rate: dto.commission_rate ?? null,
        min_price: dto.min_price ?? null,
        warehouse_location: dto.warehouse_location?.trim() || null,
        attributes: dto.attributes || [],
      },
    });

    // Registrar variantes si fueron enviadas (ej. Blanco, Negro, 1/2 pulgada)
    if (dto.variants && dto.variants.length > 0) {
      for (const v of dto.variants) {
        const vSku = (v.sku || `${sku}-${v.variant_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`).toUpperCase();
        await this.prisma.inventoryProductVariant.create({
          data: {
            company_id: companyId,
            product_id: created.id,
            sku: vSku,
            variant_name: v.variant_name.trim(),
            attribute_values: (v.attribute_values as any) ?? undefined,
            barcode: v.barcode?.trim() || null,
            additional_cost: v.additional_cost ?? 0,
            price_override: v.price_override ?? null,
            current_stock: v.current_stock ?? 0,
            is_active: v.is_active ?? true,
          },
        }).catch(() => {});
      }
    }

    // Registrar presentación base por defecto
    await (this.prisma as any).inventoryProductPresentation?.create?.({
      data: {
        company_id: companyId,
        product_id: created.id,
        presentation_name: 'Unidad Individual',
        factor: 1,
        sunat_unit_code: unitCode,
        barcode: dto.barcode?.trim() || null,
        sale_price: dto.sale_price ?? null,
        is_default: true,
      },
    });

    // Registrar presentaciones adicionales si fueron enviadas (ej. Caja x 50, Caja x 100)
    if (dto.presentations && dto.presentations.length > 0) {
      for (const p of dto.presentations) {
        if (p.presentation_name !== 'Unidad Individual') {
          await (this.prisma as any).inventoryProductPresentation?.create?.({
            data: {
              company_id: companyId,
              product_id: created.id,
              presentation_name: p.presentation_name.trim(),
              factor: p.factor,
              sunat_unit_code: p.sunat_unit_code?.trim() || 'BX',
              barcode: p.barcode?.trim() || null,
              sale_price: p.sale_price ?? null,
              is_default: p.is_default ?? false,
            },
          });
        }
      }
    }

    // Registrar proveedores si fueron enviados
    if (dto.suppliers && dto.suppliers.length > 0) {
      for (const s of dto.suppliers) {
        await (this.prisma as any).inventoryProductSupplier?.create?.({
          data: {
            company_id: companyId,
            product_id: created.id,
            supplier_id: s.supplier_id,
            supplier_product_code: s.supplier_product_code?.trim() || null,
            purchase_cost: s.purchase_cost ?? null,
            currency_code: s.currency_code?.trim().toUpperCase() || 'PEN',
            lead_time_days: s.lead_time_days ?? 0,
            is_preferred: s.is_preferred ?? false,
            notes: s.notes?.trim() || null,
          },
        }).catch(() => {});
      }
    }

    // Garantizar saldo inicial en 0 en el almacén principal para visibilidad en catálogo
    if (!isService) {
      let wh = await (this.prisma as any).inventoryWarehouse?.findFirst?.({
        where: { company_id: companyId, is_active: true },
        orderBy: { warehouse_code: 'asc' },
      });
      if (!wh && (this.prisma as any).inventoryWarehouse?.create) {
        wh = await (this.prisma as any).inventoryWarehouse
          .create({
            data: {
              company_id: companyId,
              warehouse_code: 'ALM-01',
              sunat_establishment_code: '0000',
              description: 'Almacén Principal',
            },
          })
          .catch(() => null);
      }
      if (wh && (this.prisma as any).inventoryBalance?.upsert) {
        await (this.prisma as any).inventoryBalance
          .upsert({
            where: {
              company_id_warehouse_id_product_id: {
                company_id: companyId,
                warehouse_id: wh.id,
                product_id: created.id,
              },
            },
            create: {
              company_id: companyId,
              warehouse_id: wh.id,
              product_id: created.id,
              current_stock: 0,
              average_unit_cost: dto.cost_price ?? 0,
              total_inventory_value: 0,
            },
            update: {},
          })
          .catch(() => {});
      }
    }

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
        suppliers: {
          include: { supplier: true },
        },
        presentations: {
          orderBy: { factor: 'asc' },
        },
        variants: {
          where: { is_active: true },
          orderBy: { sku: 'asc' },
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

    const updated = await this.prisma.inventoryProduct.update({
      where: { id: existing.id },
      data: {
        description: dto.description?.trim(),
        origin_type: dto.origin_type,
        ...(dto.is_service !== undefined
          ? { is_service: dto.is_service, is_inventory: !dto.is_service }
          : dto.is_inventory !== undefined
            ? { is_inventory: dto.is_inventory, is_service: !dto.is_inventory }
            : {}),
        is_active: dto.is_active,
        sunat_type_code: dto.sunat_type_code,
        sunat_unit_code: dto.sunat_unit_code,
        min_stock_alert: dto.min_stock_alert,
        brand: dto.brand?.trim(),
        model: dto.model?.trim(),
        category: dto.category?.trim(),
        manufacturer: dto.manufacturer?.trim(),
        country_of_origin: dto.country_of_origin?.trim().toUpperCase(),
        tags: dto.tags,
        barcode: dto.barcode?.trim(),
        hs_code: dto.hs_code?.trim(),
        weight_kg: dto.weight_kg,
        volume_m3: dto.volume_m3,
        tax_affectation: dto.tax_affectation,
        cost_price: dto.cost_price,
        sale_price: dto.sale_price,
        wholesale_price: dto.wholesale_price,
        promo_price: dto.promo_price,
        commission_rate: dto.commission_rate,
        min_price: dto.min_price,
        warehouse_location: dto.warehouse_location?.trim(),
        ...(dto.attributes !== undefined && { attributes: dto.attributes }),
      },
    });

    // Si se enviaron variantes, actualizar
    if (dto.variants) {
      await this.prisma.inventoryProductVariant.deleteMany({
        where: { product_id: existing.id },
      });
      for (const v of dto.variants) {
        const vSku = (v.sku || `${existing.sku}-${v.variant_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`).toUpperCase();
        await this.prisma.inventoryProductVariant.create({
          data: {
            company_id: companyId,
            product_id: existing.id,
            sku: vSku,
            variant_name: v.variant_name.trim(),
            attribute_values: (v.attribute_values as any) ?? undefined,
            barcode: v.barcode?.trim() || null,
            additional_cost: v.additional_cost ?? 0,
            price_override: v.price_override ?? null,
            current_stock: v.current_stock ?? 0,
            is_active: v.is_active ?? true,
          },
        }).catch(() => {});
      }
    }

    // Si se enviaron presentaciones, actualizar
    if (dto.presentations) {
      await (this.prisma as any).inventoryProductPresentation?.deleteMany?.({
        where: { product_id: existing.id },
      });
      for (const p of dto.presentations) {
        await (this.prisma as any).inventoryProductPresentation?.create?.({
          data: {
            company_id: companyId,
            product_id: existing.id,
            presentation_name: p.presentation_name.trim(),
            factor: p.factor,
            sunat_unit_code: p.sunat_unit_code?.trim() || 'BX',
            barcode: p.barcode?.trim() || null,
            sale_price: p.sale_price ?? null,
            is_default: p.is_default ?? false,
          },
        });
      }
    }

    // Si se enviaron proveedores, actualizar
    if (dto.suppliers) {
      await (this.prisma as any).inventoryProductSupplier?.deleteMany?.({
        where: { product_id: existing.id },
      });
      for (const s of dto.suppliers) {
        await (this.prisma as any).inventoryProductSupplier?.create?.({
          data: {
            company_id: companyId,
            product_id: existing.id,
            supplier_id: s.supplier_id,
            supplier_product_code: s.supplier_product_code?.trim() || null,
            purchase_cost: s.purchase_cost ?? null,
            currency_code: s.currency_code?.trim().toUpperCase() || 'PEN',
            lead_time_days: s.lead_time_days ?? 0,
            is_preferred: s.is_preferred ?? false,
            notes: s.notes?.trim() || null,
          },
        }).catch(() => {});
      }
    }

    return updated;
  }

  @Post('products/:sku/suppliers')
  async addProductSupplier(
    @Param('sku') sku: string,
    @Body() dto: ProductSupplierDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);

    return this.prisma.inventoryProductSupplier.upsert({
      where: {
        product_id_supplier_id: {
          product_id: product.id,
          supplier_id: dto.supplier_id,
        },
      },
      update: {
        supplier_product_code: dto.supplier_product_code?.trim() || null,
        purchase_cost: dto.purchase_cost ?? null,
        currency_code: dto.currency_code?.trim().toUpperCase() || 'PEN',
        lead_time_days: dto.lead_time_days ?? 0,
        is_preferred: dto.is_preferred ?? false,
        notes: dto.notes?.trim() || null,
      },
      create: {
        company_id: companyId,
        product_id: product.id,
        supplier_id: dto.supplier_id,
        supplier_product_code: dto.supplier_product_code?.trim() || null,
        purchase_cost: dto.purchase_cost ?? null,
        currency_code: dto.currency_code?.trim().toUpperCase() || 'PEN',
        lead_time_days: dto.lead_time_days ?? 0,
        is_preferred: dto.is_preferred ?? false,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  @Delete('products/:sku/suppliers/:supplierId')
  async deleteProductSupplier(
    @Param('sku') sku: string,
    @Param('supplierId') supplierId: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);

    return this.prisma.inventoryProductSupplier.deleteMany({
      where: { product_id: product.id, supplier_id: supplierId },
    });
  }

  @Post('products/:sku/presentations')
  async addProductPresentation(
    @Param('sku') sku: string,
    @Body() dto: ProductPresentationDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!product) throw new NotFoundException(`Producto ${sku} no encontrado.`);

    return this.prisma.inventoryProductPresentation.create({
      data: {
        company_id: companyId,
        product_id: product.id,
        presentation_name: dto.presentation_name.trim(),
        factor: dto.factor,
        sunat_unit_code: dto.sunat_unit_code?.trim() || 'BX',
        barcode: dto.barcode?.trim() || null,
        sale_price: dto.sale_price ?? null,
        is_default: dto.is_default ?? false,
      },
    });
  }

  @Delete('products/:sku/presentations/:id')
  async deleteProductPresentation(
    @Param('sku') sku: string,
    @Param('id') id: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.prisma.inventoryProductPresentation.deleteMany({
      where: { id, company_id: companyId },
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
      await this.prisma.inventoryProduct.update({
        where: { id: existing.id },
        data: { is_active: false },
      });
      return {
        action: 'DEACTIVATED',
        message: `El producto "${sku}" tiene ${movementCount} movimiento(s) registrado(s) en el Kardex. Por trazabilidad tributaria (NIC 2 / SUNAT), no puede eliminarse físicamente; ha sido marcado como INACTIVO / DESCONTINUADO.`,
      };
    }

    await (this.prisma as any).inventoryProductPresentation?.deleteMany?.({
      where: { product_id: existing.id },
    });
    await (this.prisma as any).inventoryProductVariant?.deleteMany?.({
      where: { product_id: existing.id },
    });
    await (this.prisma as any).inventoryProductSupplier?.deleteMany?.({
      where: { product_id: existing.id },
    });
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
    @Query('metodo') metodo?: 'PROMEDIO' | 'FIFO',
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.getKardexUseCase.execute(
      { sku, start_date: startDate, end_date: endDate, metodo },
      companyId,
    );
  }

  // --------------------------------------------------------------------------
  // Variantes de Producto y Atributos (Obs 10, 25)
  // --------------------------------------------------------------------------
  @Get('products/:sku/variants')
  async listProductVariants(
    @Param('sku') sku: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!product) throw new NotFoundException(`Producto con SKU "${sku}" no encontrado.`);

    return this.prisma.inventoryProductVariant.findMany({
      where: { product_id: product.id, company_id: companyId, is_active: true },
      orderBy: { sku: 'asc' },
    });
  }

  @Post('products/:sku/variants')
  @HttpCode(HttpStatus.CREATED)
  async addProductVariant(
    @Param('sku') sku: string,
    @Body() dto: ProductVariantDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    if (!product) throw new NotFoundException(`Producto con SKU "${sku}" no encontrado.`);

    const vSku = (dto.sku || `${product.sku}-${dto.variant_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`).toUpperCase();

    return this.prisma.inventoryProductVariant.create({
      data: {
        company_id: companyId,
        product_id: product.id,
        sku: vSku,
        variant_name: dto.variant_name.trim(),
        attribute_values: (dto.attribute_values as any) ?? undefined,
        barcode: dto.barcode?.trim() || null,
        additional_cost: dto.additional_cost ?? 0,
        price_override: dto.price_override ?? null,
        current_stock: dto.current_stock ?? 0,
        is_active: dto.is_active ?? true,
      },
    });
  }

  @Delete('products/:sku/variants/:variantId')
  async deleteProductVariant(
    @Param('sku') sku: string,
    @Param('variantId') variantId: string,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.prisma.inventoryProductVariant.update({
      where: { id: variantId },
      data: { is_active: false },
    });
  }
}
