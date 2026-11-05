import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InventoryOpeningService } from '../../application/services/inventoryOpeningService';
import { CreateOpeningDto } from '../../application/dto/inventoryOpeningDto';

@Controller('api/v1/inventory/opening')
@UseGuards(AuthGuard)
export class InventoryOpeningController {
  constructor(private readonly opening: InventoryOpeningService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateOpeningDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.opening.create(companyId, dto);
  }
}
