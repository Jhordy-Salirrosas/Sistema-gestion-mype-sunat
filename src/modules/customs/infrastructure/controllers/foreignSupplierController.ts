import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ForeignSupplierDto } from '../../application/dto/foreignSupplierDto';
import { ForeignSupplierService } from '../../application/services/foreignSupplierService';

@Controller('api/v1/customs/suppliers')
@UseGuards(AuthGuard)
export class ForeignSupplierController {
  constructor(private readonly suppliers: ForeignSupplierService) {}

  @Get()
  list(@CurrentCompany() companyId: string | undefined, @Query('q') q?: string) {
    return this.suppliers.list(this.empresa(companyId), q);
  }

  @Post()
  create(@CurrentCompany() companyId: string | undefined, @Body() dto: ForeignSupplierDto) {
    return this.suppliers.create(this.empresa(companyId), dto);
  }

  @Put(':id')
  update(@CurrentCompany() companyId: string | undefined, @Param('id') id: string, @Body() dto: ForeignSupplierDto) {
    return this.suppliers.update(this.empresa(companyId), id, dto);
  }

  @Delete(':id')
  remove(@CurrentCompany() companyId: string | undefined, @Param('id') id: string) {
    return this.suppliers.remove(this.empresa(companyId), id);
  }

  private empresa(companyId?: string): string {
    if (!companyId) throw new Error('La empresa es obligatoria.');
    return companyId;
  }
}
