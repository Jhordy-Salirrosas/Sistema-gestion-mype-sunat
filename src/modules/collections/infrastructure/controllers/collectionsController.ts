import { Body, Controller, Get, HttpCode, HttpStatus, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateCollectionDto } from '../../application/dto/createCollectionDto';
import { CollectionsService } from '../../application/services/collectionsService';

@Controller('api/v1/collections')
@UseGuards(AuthGuard)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

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
