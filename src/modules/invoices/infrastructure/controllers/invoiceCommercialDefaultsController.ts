import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { InvoiceCommercialDefaultsService } from '../../application/services/invoiceCommercialDefaultsService';

@Controller('api/v1/invoices/commercial-defaults')
@UseGuards(AuthGuard)
export class InvoiceCommercialDefaultsController {
  constructor(private readonly defaults: InvoiceCommercialDefaultsService) {}
  @Get() get(@CurrentCompany() companyId: string) { return this.defaults.get(companyId); }
  @Put() @Roles('ADMIN') @UseGuards(RolesGuard)
  save(@CurrentCompany() companyId: string, @Body() body: unknown) { return this.defaults.save(companyId, body); }
}
