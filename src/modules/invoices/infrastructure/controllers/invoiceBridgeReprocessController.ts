import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { InvoiceBridgeCoordinatorService } from '../../application/services/invoiceBridgeCoordinatorService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoiceBridgeReprocessController {
  constructor(private readonly puente: InvoiceBridgeCoordinatorService) {}

  @Post(':id/reprocesar-puente')
  @HttpCode(200)
  reprocesar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.puente.reprocesar(companyId, id);
  }
}
