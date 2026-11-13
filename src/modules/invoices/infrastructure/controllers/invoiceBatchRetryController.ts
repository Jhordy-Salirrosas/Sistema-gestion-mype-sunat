import { Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { InvoiceBatchRetryService } from '../../application/services/invoiceBatchRetryService';

interface BatchOperations { ejecutar: InvoiceBatchRetryService['ejecutar'] }

@Controller('api/v1/invoices/retry-batch')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoiceBatchRetryController {
  constructor(@Inject(InvoiceBatchRetryService) private readonly reintentos: BatchOperations) {}
  @Get()
  previa(@CurrentCompany() companyId: string) { return this.reintentos.ejecutar(companyId,true); }
  @Post()
  @HttpCode(200)
  ejecutar(@CurrentCompany() companyId: string) { return this.reintentos.ejecutar(companyId); }
}
