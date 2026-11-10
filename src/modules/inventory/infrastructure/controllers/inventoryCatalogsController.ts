import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryCatalogsService } from '../../application/services/inventoryCatalogsService';

@Controller('api/v1/inventory/catalogs')
@UseGuards(AuthGuard)
export class InventoryCatalogsController {
  constructor(private readonly catalogsService: InventoryCatalogsService) {}

  @Get('units')
  async listUnits() {
    return this.catalogsService.listSunatUnits();
  }

  @Get('existence-types')
  async listExistenceTypes() {
    return this.catalogsService.listSunatExistenceTypes();
  }

  // Marcas
  @Get('brands')
  async listBrands(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listBrands(companyId);
  }

  @Post('brands')
  @HttpCode(HttpStatus.CREATED)
  async createBrand(
    @Body() dto: { name: string; code?: string; description?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.createBrand(companyId, dto);
  }

  @Put('brands/:id')
  async updateBrand(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; description?: string; is_active?: boolean },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.updateBrand(companyId, id, dto);
  }

  @Delete('brands/:id')
  async deleteBrand(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.deleteBrand(companyId, id);
  }

  // Modelos
  @Get('models')
  async listModels(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listModels(companyId);
  }

  @Post('models')
  @HttpCode(HttpStatus.CREATED)
  async createModel(
    @Body() dto: { name: string; code?: string; brand_name?: string; description?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.createModel(companyId, dto);
  }

  @Put('models/:id')
  async updateModel(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; brand_name?: string; description?: string; is_active?: boolean },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.updateModel(companyId, id, dto);
  }

  @Delete('models/:id')
  async deleteModel(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.deleteModel(companyId, id);
  }

  // Categorías
  @Get('categories')
  async listCategories(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listCategories(companyId);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() dto: { name: string; code?: string; sunat_code?: string; description?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.createCategory(companyId, dto);
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; sunat_code?: string; description?: string; is_active?: boolean },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.updateCategory(companyId, id, dto);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.deleteCategory(companyId, id);
  }

  // Fabricantes
  @Get('manufacturers')
  async listManufacturers(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listManufacturers(companyId);
  }

  @Post('manufacturers')
  @HttpCode(HttpStatus.CREATED)
  async createManufacturer(
    @Body() dto: { name: string; country_code?: string; website?: string; contact_info?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.createManufacturer(companyId, dto);
  }

  @Put('manufacturers/:id')
  async updateManufacturer(
    @Param('id') id: string,
    @Body() dto: { name?: string; country_code?: string; website?: string; contact_info?: string; is_active?: boolean },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.updateManufacturer(companyId, id, dto);
  }

  @Delete('manufacturers/:id')
  async deleteManufacturer(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.deleteManufacturer(companyId, id);
  }

  // Tags / Etiquetas
  @Get('tags')
  async listTags(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listTags(companyId);
  }

  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  async createTag(
    @Body() dto: { name: string; color?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.createTag(companyId, dto);
  }

  @Put('tags/:id')
  async updateTag(
    @Param('id') id: string,
    @Body() dto: { name?: string; color?: string },
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.updateTag(companyId, id, dto);
  }

  @Delete('tags/:id')
  async deleteTag(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.deleteTag(companyId, id);
  }

  // Responsables Autorizados (Usuarios y Transportistas) (Obs 19 y 20)
  @Get('responsibles')
  async listResponsibles(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.catalogsService.listAuthorizedResponsibles(companyId);
  }
}

