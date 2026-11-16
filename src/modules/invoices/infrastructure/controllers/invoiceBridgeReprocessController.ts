import { RequireAction } from '../../../auth/infrastructure/decorators/actionPermissionDecorator';
import { ActionPermissionsGuard } from '../../../auth/infrastructure/guards/actionPermissionsGuard';
import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { InvoiceBridgeCoordinatorService } from '../../application/services/invoiceBridgeCoordinatorService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard, RolesGuard, ActionPermissionsGuard)
@RequireAction('INVOICE_REPROCESS_BRIDGE')
@Roles('ADMIN')
export class InvoiceBridgeReprocessController {
  constructor(private readonly puente: InvoiceBridgeCoordinatorService) {}

  @Post(':id/reprocesar-puente')
  @HttpCode(200)
  reprocesar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.puente.reprocesar(companyId, id);
  }
}
