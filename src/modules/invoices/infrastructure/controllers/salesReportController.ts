import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { SalesReportService } from '../../application/services/salesReportService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class SalesReportController {
  constructor(private readonly salesReport: SalesReportService) {}

  @Get('reports/sales')
  report(@CurrentCompany() companyId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!companyId) throw new BadRequestException('Identificador de empresa requerido.');
    return this.salesReport.execute(companyId, from, to);
  }
}
