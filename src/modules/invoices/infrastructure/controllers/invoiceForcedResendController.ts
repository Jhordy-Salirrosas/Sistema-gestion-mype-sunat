import { RequireAction } from '../../../auth/infrastructure/decorators/actionPermissionDecorator';
import { ActionPermissionsGuard } from '../../../auth/infrastructure/guards/actionPermissionsGuard';
import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, CurrentUser, RequireCapability } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CapabilityGuard } from '../../../auth/infrastructure/guards/capabilityGuard';
import { InvoiceForcedResendService } from '../../application/services/invoiceForcedResendService';
@Controller('api/v1/invoices')
@UseGuards(AuthGuard, CapabilityGuard, ActionPermissionsGuard)
@RequireAction('INVOICE_FORCE_RESEND')
@RequireCapability('INVOICE_FORCE_RESEND')
export class InvoiceForcedResendController {
 constructor(private readonly force: InvoiceForcedResendService) {}
 @Post(':id/forzar-reenvio') @HttpCode(200)
 autorizar(@CurrentCompany() company: string, @Param('id') id: string, @CurrentUser() user: { sub: string; role: string }, @Body() body: unknown) {
  return this.force.autorizar(company, id, user, body);
 }
}
