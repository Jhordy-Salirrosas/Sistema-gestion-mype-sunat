import { RequireAction } from '../../../auth/infrastructure/decorators/actionPermissionDecorator';
import { ActionPermissionsGuard } from '../../../auth/infrastructure/guards/actionPermissionsGuard';
import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, RequireCapability } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CapabilityGuard } from '../../../auth/infrastructure/guards/capabilityGuard';
import { InvoiceBridgeCoordinatorService } from '../../application/services/invoiceBridgeCoordinatorService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard, CapabilityGuard, ActionPermissionsGuard)
@RequireAction('INVOICE_REPROCESS_BRIDGE')
@RequireCapability('INVOICE_REPROCESS_BRIDGE')
export class InvoiceBridgeReprocessController {
  constructor(private readonly puente: InvoiceBridgeCoordinatorService) {}

  @Post(':id/reprocesar-puente')
  @HttpCode(200)
  reprocesar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.puente.reprocesar(companyId, id);
  }
}
