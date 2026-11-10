import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, CurrentUser, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { InvoiceForcedResendService } from '../../application/services/invoiceForcedResendService';
@Controller('api/v1/invoices')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoiceForcedResendController {
 constructor(private readonly force: InvoiceForcedResendService) {}
 @Post(':id/forzar-reenvio') @HttpCode(200)
 autorizar(@CurrentCompany() company: string, @Param('id') id: string, @CurrentUser() user: { sub: string; role: string }, @Body() body: unknown) {
  return this.force.autorizar(company, id, user, body);
 }
}
