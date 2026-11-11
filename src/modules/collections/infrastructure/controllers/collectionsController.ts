import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateCollectionDto } from '../../application/dto/createCollectionDto';
import { CollectionsService } from '../../application/services/collectionsService';

@Controller('api/v1/collections')
@UseGuards(AuthGuard)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Post(':id/annul')
  @HttpCode(HttpStatus.OK)
  annul(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.annul(companyId, id);
  }

  @Get('invoice/:id')
  invoiceCollections(@Param('id') id: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.invoiceCollections(companyId, id);
  }

  @Get('portfolio')
  portfolio(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.portfolioAging(companyId);
  }

  @Get('statement')
  statement(@Query('doc') doc: string, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.customerStatement(companyId, doc ?? '');
  }

  @Get('receivables')
  receivables(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.listReceivables(companyId);
  }

  @Get()
  list(@CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.list(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCollectionDto, @CurrentCompany() companyId?: string) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.collections.create(companyId, dto);
  }
}
